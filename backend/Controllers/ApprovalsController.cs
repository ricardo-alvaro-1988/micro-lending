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
[Route("api/approvals")]
[Authorize]
public class ApprovalsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly LoanWorkflowService _workflow;
    private readonly BranchScopeService _branchScope;

    public ApprovalsController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        LoanWorkflowService workflow,
        BranchScopeService branchScope)
    {
        _db = db;
        _userManager = userManager;
        _workflow = workflow;
        _branchScope = branchScope;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.ApprovalsView}")]
    public async Task<ActionResult<IEnumerable<ApprovalDto>>> GetPending(
        [FromQuery] bool mineOnly = false,
        [FromQuery] int? branchId = null)
    {
        var user = await ResolveUserAsync();
        if (user is null) return Unauthorized();
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var ctx = await _workflow.GetApproverContextAsync(user);
        var pending = await LoadActivePendingAsync(scope);

        var result = new List<ApprovalDto>();
        foreach (var a in pending)
        {
            var canAct = _workflow.CanUserApproveStage(a.Stage, ctx);
            if (mineOnly && !canAct) continue;
            result.Add(Map(a, canAct));
        }

        return Ok(result);
    }

    /// <summary>Pending approvals assigned to the current user (for notifications).</summary>
    [HttpGet("mine/summary")]
    [Authorize(Policy = $"perm:{PermissionCodes.ApprovalsView}")]
    public async Task<ActionResult<ApprovalNotificationSummaryDto>> MySummary()
    {
        var user = await ResolveUserAsync();
        if (user is null) return Unauthorized();
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var ctx = await _workflow.GetApproverContextAsync(user);
        var pending = await LoadActivePendingAsync(scope);

        var mine = pending
            .Where(a => _workflow.CanUserApproveStage(a.Stage, ctx))
            .Select(a => Map(a, true))
            .ToList();

        return Ok(new ApprovalNotificationSummaryDto(mine.Count, mine.Take(5).ToList()));
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Policy = $"perm:{PermissionCodes.ApprovalsManage}")]
    public async Task<ActionResult<ApprovalDto>> Approve(int id, [FromBody] ApprovalActionRequest? request)
    {
        return await DecideAsync(id, ApprovalDecision.Approved, request?.Comments);
    }

    [HttpPost("{id:int}/reject")]
    [Authorize(Policy = $"perm:{PermissionCodes.ApprovalsManage}")]
    public async Task<ActionResult<ApprovalDto>> Reject(int id, [FromBody] ApprovalActionRequest? request)
    {
        return await DecideAsync(id, ApprovalDecision.Rejected, request?.Comments);
    }

    private async Task<ActionResult<ApprovalDto>> DecideAsync(int id, ApprovalDecision decision, string? comments)
    {
        var user = await ResolveUserAsync();
        if (user is null) return Unauthorized();

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var approval = await _db.LoanApprovals
            .Include(a => a.Loan).ThenInclude(l => l.Customer)
            .Include(a => a.Stage)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (approval is null) return NotFound(new { message = "Approval not found." });
        if (!BranchScopeService.CanAccessBranch(scope, approval.Loan.Customer.BranchId))
            return NotFound(new { message = "Approval not found." });
        if (approval.Decision != ApprovalDecision.Pending)
            return BadRequest(new { message = "Approval already decided." });

        if (approval.Loan.Status != LoanStatus.PendingApproval || approval.Loan.CurrentStageId != approval.StageId)
            return BadRequest(new { message = "This approval is no longer the active loan stage." });

        var ctx = await _workflow.GetApproverContextAsync(user);
        if (!_workflow.CanUserApproveStage(approval.Stage, ctx))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You are not assigned to approve this stage." });

        if (string.IsNullOrWhiteSpace(comments))
            return BadRequest(new { message = "Approval notes are required." });

        var notes = comments.Trim();
        approval.Decision = decision;
        approval.DecidedByUserId = user.Id;
        approval.Comments = notes;
        approval.DecidedAt = DateTime.UtcNow;

        var loan = await _db.Loans
            .Include(l => l.CurrentStage)
            .FirstAsync(l => l.Id == approval.LoanId);

        try
        {
            await _workflow.ApplyApprovalDecisionAsync(
                loan,
                approval.Stage,
                approved: decision == ApprovalDecision.Approved,
                actor: user,
                comments: notes);
            await _db.SaveChangesAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        return Ok(Map(approval, false));
    }

    private async Task<List<LoanApproval>> LoadActivePendingAsync(BranchScope scope)
    {
        var query = _db.LoanApprovals
            .AsNoTracking()
            .Include(a => a.Loan).ThenInclude(l => l.Customer)
            .Include(a => a.Stage)
            .Where(a => a.Decision == ApprovalDecision.Pending)
            .Where(a => a.Loan.Status == LoanStatus.PendingApproval)
            .Where(a => a.StageId == a.Loan.CurrentStageId);

        if (!(scope.IsAdmin && scope.EffectiveBranchId is null))
        {
            if (scope.EffectiveBranchId is int branchId)
                query = query.Where(a => a.Loan.Customer.BranchId == branchId);
            else
                query = query.Where(_ => false);
        }

        return await query.OrderByDescending(a => a.RequestedAt).ToListAsync();
    }

    private async Task<ApplicationUser?> ResolveUserAsync()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is not null) return user;

        var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                 ?? User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _userManager.FindByIdAsync(id);
    }

    private static ApprovalDto Map(LoanApproval a, bool canAct) =>
        new(
            a.Id,
            a.LoanId,
            a.Loan.LoanNumber,
            a.Loan.Customer.FullName,
            a.Stage.Name,
            a.Loan.Amount,
            a.Decision.ToString(),
            a.RequestedAt,
            canAct);
}
