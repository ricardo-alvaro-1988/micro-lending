using System.Security.Claims;
using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
using MicroLending.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/remittances")]
[Authorize]
public class RemittancesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly BranchScopeService _branchScope;
    private readonly AuditService _audit;

    public RemittancesController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        BranchScopeService branchScope,
        AuditService audit)
    {
        _db = db;
        _userManager = userManager;
        _branchScope = branchScope;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.RemittanceView}")]
    public async Task<ActionResult<IEnumerable<CashRemittanceDto>>> GetAll(
        [FromQuery] string? agentUserId = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var query = _db.CashRemittances
            .Include(r => r.AgentUser)
            .Include(r => r.Branch)
            .Include(r => r.CreatedByUser)
            .Include(r => r.ReceivedByUser)
            .AsQueryable();

        if (scope.EffectiveBranchId is int bid)
            query = query.Where(r => r.BranchId == bid);
        else if (!scope.IsAdmin && scope.UserBranchId is null)
            query = query.Where(_ => false);

        if (!string.IsNullOrWhiteSpace(agentUserId))
            query = query.Where(r => r.AgentUserId == agentUserId);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<CashRemittanceStatus>(status, ignoreCase: true, out var st))
            query = query.Where(r => r.Status == st);

        if (from is DateTime fromDt)
            query = query.Where(r => r.RemittanceDate >= fromDt.Date);

        if (to is DateTime toDt)
            query = query.Where(r => r.RemittanceDate <= toDt.Date);

        var rows = await query
            .OrderByDescending(r => r.RemittanceDate)
            .ThenByDescending(r => r.Id)
            .Take(200)
            .ToListAsync();

        return Ok(rows.Select(Map).ToList());
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.RemittanceView}")]
    public async Task<ActionResult<CashRemittanceDto>> Get(int id)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var row = await LoadAsync(id);
        if (row is null) return NotFound();
        if (!CanSee(scope, row)) return NotFound();
        return Ok(Map(row));
    }

    [HttpGet("expected-collected")]
    [Authorize(Policy = $"perm:{PermissionCodes.RemittanceView}")]
    public async Task<ActionResult<object>> ExpectedCollected(
        [FromQuery] string agentUserId,
        [FromQuery] DateTime remittanceDate)
    {
        if (string.IsNullOrWhiteSpace(agentUserId))
            return BadRequest(new { message = "agentUserId is required." });

        var amount = await SumCollectedAsync(agentUserId, remittanceDate.Date);
        return Ok(new { agentUserId, remittanceDate = remittanceDate.Date, expectedCollected = amount });
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.RemittanceManage}")]
    public async Task<ActionResult<CashRemittanceDto>> Create([FromBody] CreateCashRemittanceRequest request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var agent = await _userManager.Users.FirstOrDefaultAsync(u => u.Id == request.AgentUserId && !u.IsDeleted);
        if (agent is null) return BadRequest(new { message = "Agent user not found." });

        var branchId = request.BranchId ?? agent.BranchId;
        if (!scope.IsAdmin)
            branchId = BranchScopeService.EnforceWriteBranchId(scope, branchId);

        if (branchId is int bid && !BranchScopeService.CanAccessBranch(scope, bid))
            return BadRequest(new { message = "Branch is outside your scope." });

        var date = request.RemittanceDate.Date;
        var collected = await SumCollectedAsync(agent.Id, date);
        var remitted = decimal.Round(request.RemittedAmount, 2);
        var variance = collected - remitted;

        var actorId = CurrentUserId();
        if (string.IsNullOrEmpty(actorId)) return Unauthorized();

        var row = new CashRemittance
        {
            AgentUserId = agent.Id,
            BranchId = branchId,
            RemittanceDate = date,
            CollectedAmount = collected,
            RemittedAmount = remitted,
            Variance = variance,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Status = CashRemittanceStatus.Draft,
            CreatedByUserId = actorId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.CashRemittances.Add(row);
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "Created",
            "CashRemittance",
            row.Id.ToString(),
            $"Created remittance draft for {agent.FullName} on {date:yyyy-MM-dd} (collected {collected:0.00}, remitted {remitted:0.00})",
            new { row.AgentUserId, row.RemittanceDate, row.CollectedAmount, row.RemittedAmount, row.Variance });

        row = await LoadAsync(row.Id);
        return CreatedAtAction(nameof(Get), new { id = row!.Id }, Map(row));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.RemittanceManage}")]
    public async Task<ActionResult<CashRemittanceDto>> Update(int id, [FromBody] UpdateCashRemittanceRequest request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var row = await LoadAsync(id);
        if (row is null) return NotFound();
        if (!CanSee(scope, row)) return NotFound();
        if (row.Status != CashRemittanceStatus.Draft)
            return BadRequest(new { message = "Only draft remittances can be updated." });

        row.RemittedAmount = decimal.Round(request.RemittedAmount, 2);
        row.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        row.CollectedAmount = await SumCollectedAsync(row.AgentUserId, row.RemittanceDate.Date);
        row.Variance = row.CollectedAmount - row.RemittedAmount;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "Updated",
            "CashRemittance",
            row.Id.ToString(),
            $"Updated remittance #{row.Id} (collected {row.CollectedAmount:0.00}, remitted {row.RemittedAmount:0.00}, variance {row.Variance:0.00})",
            new { row.CollectedAmount, row.RemittedAmount, row.Variance, row.Notes });

        row = await LoadAsync(row.Id);
        return Ok(Map(row!));
    }

    [HttpPost("{id:int}/submit")]
    [Authorize(Policy = $"perm:{PermissionCodes.RemittanceManage}")]
    public async Task<ActionResult<CashRemittanceDto>> Submit(int id)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var row = await LoadAsync(id);
        if (row is null) return NotFound();
        if (!CanSee(scope, row)) return NotFound();
        if (row.Status != CashRemittanceStatus.Draft)
            return BadRequest(new { message = "Only draft remittances can be submitted." });

        // Refresh collected from live payments before locking the draft.
        row.CollectedAmount = await SumCollectedAsync(row.AgentUserId, row.RemittanceDate.Date);
        row.Variance = row.CollectedAmount - row.RemittedAmount;
        row.Status = CashRemittanceStatus.Submitted;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "Submitted",
            "CashRemittance",
            row.Id.ToString(),
            $"Submitted remittance #{row.Id} for {row.AgentUser.FullName} (variance {row.Variance:0.00})",
            new { row.CollectedAmount, row.RemittedAmount, row.Variance });

        row = await LoadAsync(row.Id);
        return Ok(Map(row!));
    }

    [HttpPost("{id:int}/receive")]
    [Authorize(Policy = $"perm:{PermissionCodes.RemittanceReceive}")]
    public async Task<ActionResult<CashRemittanceDto>> Receive(int id, [FromBody] ReceiveCashRemittanceRequest? request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var row = await LoadAsync(id);
        if (row is null) return NotFound();
        if (!CanSee(scope, row)) return NotFound();
        if (row.Status is not (CashRemittanceStatus.Submitted or CashRemittanceStatus.Discrepancy))
            return BadRequest(new { message = "Only submitted remittances can be received." });

        var actorId = CurrentUserId();
        if (string.IsNullOrEmpty(actorId)) return Unauthorized();

        if (request?.RemittedAmount is decimal actual)
            row.RemittedAmount = decimal.Round(actual, 2);

        if (!string.IsNullOrWhiteSpace(request?.Notes))
            row.Notes = request.Notes.Trim();

        row.Variance = row.CollectedAmount - row.RemittedAmount;
        row.Status = row.Variance == 0 ? CashRemittanceStatus.Received : CashRemittanceStatus.Discrepancy;
        row.ReceivedByUserId = actorId;
        row.ReceivedAt = DateTime.UtcNow;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "Received",
            "CashRemittance",
            row.Id.ToString(),
            $"Received remittance #{row.Id} as {row.Status} (collected {row.CollectedAmount:0.00}, remitted {row.RemittedAmount:0.00}, variance {row.Variance:0.00})",
            new { row.CollectedAmount, row.RemittedAmount, row.Variance, Status = row.Status.ToString() });

        row = await LoadAsync(row.Id);
        return Ok(Map(row!));
    }

    private async Task<CashRemittance?> LoadAsync(int id) =>
        await _db.CashRemittances
            .Include(r => r.AgentUser)
            .Include(r => r.Branch)
            .Include(r => r.CreatedByUser)
            .Include(r => r.ReceivedByUser)
            .FirstOrDefaultAsync(r => r.Id == id);

    private static bool CanSee(BranchScope scope, CashRemittance row)
    {
        if (scope.IsAdmin && scope.EffectiveBranchId is null) return true;
        return BranchScopeService.CanAccessBranch(scope, row.BranchId);
    }

    private async Task<decimal> SumCollectedAsync(string agentUserId, DateTime date)
    {
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);
        // PaidAt may be stored as UTC or local; compare by calendar date of PaidAt.
        var sum = await _db.LoanPayments
            .Where(p => p.RecordedByUserId == agentUserId)
            .Where(p => p.PaidAt >= dayStart && p.PaidAt < dayEnd)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;
        return decimal.Round(sum, 2);
    }

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

    private static CashRemittanceDto Map(CashRemittance r) =>
        new(
            r.Id,
            r.AgentUserId,
            r.AgentUser.FullName,
            r.BranchId,
            r.Branch?.Name,
            r.RemittanceDate,
            r.CollectedAmount,
            r.RemittedAmount,
            r.Variance,
            r.Notes,
            r.Status.ToString(),
            r.CreatedByUserId,
            r.CreatedByUser.FullName,
            r.ReceivedByUserId,
            r.ReceivedByUser?.FullName,
            r.CreatedAt,
            r.UpdatedAt,
            r.ReceivedAt);
}
