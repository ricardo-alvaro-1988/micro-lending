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
[Route("api/expenses")]
[Authorize]
public class ExpensesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly BranchScopeService _branchScope;

    public ExpensesController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        BranchScopeService branchScope)
    {
        _db = db;
        _userManager = userManager;
        _branchScope = branchScope;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.ExpensesView}")]
    public async Task<ActionResult<IEnumerable<ExpenseEntryDto>>> List(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var query = Scoped(_db.ExpenseEntries.AsNoTracking()
            .Include(e => e.Branch)
            .Include(e => e.RecordedByUser), scope);

        if (from is DateTime f) query = query.Where(e => e.ExpenseDate >= f.Date);
        if (to is DateTime t) query = query.Where(e => e.ExpenseDate < t.Date.AddDays(1));

        var rows = await query
            .OrderByDescending(e => e.ExpenseDate)
            .ThenByDescending(e => e.Id)
            .Take(500)
            .ToListAsync();

        return Ok(rows.Select(Map));
    }

    /// <summary>Total expense widget for a single date or date range.</summary>
    [HttpGet("summary")]
    [Authorize(Policy = $"perm:{PermissionCodes.ExpensesView}")]
    public async Task<ActionResult<ExpenseSummaryDto>> Summary(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var start = (from ?? PhilippineTime.Today).Date;
        var end = (to ?? start).Date;
        var endExclusive = end.AddDays(1);

        var query = Scoped(_db.ExpenseEntries.AsNoTracking(), scope)
            .Where(e => e.ExpenseDate >= start && e.ExpenseDate < endExclusive);

        var count = await query.CountAsync();
        var total = count == 0 ? 0m : await query.SumAsync(e => e.Amount);

        return Ok(new ExpenseSummaryDto(start, end, count, total));
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.ExpensesManage}")]
    public async Task<ActionResult<ExpenseEntryDto>> Create([FromBody] CreateExpenseEntryRequest request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var label = request.Label?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(label))
            return BadRequest(new { message = "Label is required." });
        if (request.Amount <= 0)
            return BadRequest(new { message = "Amount must be greater than zero." });

        var branchId = BranchScopeService.EnforceWriteBranchId(scope, request.BranchId ?? user.BranchId);
        var row = new ExpenseEntry
        {
            Label = label,
            Amount = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero),
            ExpenseDate = (request.ExpenseDate == default ? PhilippineTime.Today : request.ExpenseDate).Date,
            BranchId = branchId,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            RecordedByUserId = user.Id,
            CreatedAt = PhilippineTime.Now,
            UpdatedAt = PhilippineTime.Now,
        };
        _db.ExpenseEntries.Add(row);
        await _db.SaveChangesAsync();

        var saved = await LoadAsync(row.Id);
        return Ok(Map(saved!));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.ExpensesManage}")]
    public async Task<ActionResult<ExpenseEntryDto>> Update(int id, [FromBody] UpdateExpenseEntryRequest request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var row = await _db.ExpenseEntries.FirstOrDefaultAsync(e => e.Id == id);
        if (row is null) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, row.BranchId)) return NotFound();

        var label = request.Label?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(label))
            return BadRequest(new { message = "Label is required." });
        if (request.Amount <= 0)
            return BadRequest(new { message = "Amount must be greater than zero." });

        row.Label = label;
        row.Amount = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero);
        row.ExpenseDate = (request.ExpenseDate == default ? row.ExpenseDate : request.ExpenseDate).Date;
        row.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        row.UpdatedAt = PhilippineTime.Now;
        await _db.SaveChangesAsync();

        var saved = await LoadAsync(row.Id);
        return Ok(Map(saved!));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.ExpensesManage}")]
    public async Task<IActionResult> Delete(int id)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var row = await _db.ExpenseEntries.FirstOrDefaultAsync(e => e.Id == id);
        if (row is null) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, row.BranchId)) return NotFound();

        _db.ExpenseEntries.Remove(row);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static IQueryable<ExpenseEntry> Scoped(IQueryable<ExpenseEntry> query, BranchScope scope)
    {
        if (scope.IsAdmin && scope.EffectiveBranchId is null) return query;
        if (scope.EffectiveBranchId is int bid) return query.Where(e => e.BranchId == bid);
        return query.Where(_ => false);
    }

    private async Task<ExpenseEntry?> LoadAsync(int id) =>
        await _db.ExpenseEntries
            .Include(e => e.Branch)
            .Include(e => e.RecordedByUser)
            .FirstOrDefaultAsync(e => e.Id == id);

    private static ExpenseEntryDto Map(ExpenseEntry e) =>
        new(
            e.Id,
            e.Label,
            e.Amount,
            e.ExpenseDate,
            e.BranchId,
            e.Branch?.Name,
            e.Notes,
            e.RecordedByUserId,
            e.RecordedByUser.FullName,
            e.CreatedAt,
            e.UpdatedAt);
}
