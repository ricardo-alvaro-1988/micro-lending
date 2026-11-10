using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
using MicroLending.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/activity")]
[Authorize(Policy = $"perm:{PermissionCodes.ActivityView}")]
public class ActivityController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BranchScopeService _branchScope;

    public ActivityController(AppDbContext db, BranchScopeService branchScope)
    {
        _db = db;
        _branchScope = branchScope;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanActivityTrailDto>>> GetAll(
        [FromQuery] string? q = null,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var query = BranchScopeService.Loans(
            _db.Loans
                .Include(l => l.Customer)
                .Include(l => l.Flow)
                .Include(l => l.CurrentStage)
                .Include(l => l.CreatedByUser)
                .Include(l => l.Activities)
                .Include(l => l.Approvals).ThenInclude(a => a.Stage)
                .Include(l => l.Approvals).ThenInclude(a => a.DecidedByUser)
                .AsQueryable(),
            scope);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(l =>
                l.LoanNumber.Contains(term) ||
                l.Customer.FullName.Contains(term));
        }

        var loans = await query.OrderByDescending(l => l.UpdatedAt).Take(100).ToListAsync();
        return Ok(loans.Select(MapTrail).ToList());
    }

    [HttpGet("{loanId:int}")]
    public async Task<ActionResult<LoanActivityTrailDto>> Get(int loanId)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var loan = await _db.Loans
            .Include(l => l.Customer)
            .Include(l => l.Flow)
            .Include(l => l.CurrentStage)
            .Include(l => l.CreatedByUser)
            .Include(l => l.Activities)
            .Include(l => l.Approvals).ThenInclude(a => a.Stage)
            .Include(l => l.Approvals).ThenInclude(a => a.DecidedByUser)
            .FirstOrDefaultAsync(l => l.Id == loanId);
        if (loan is null) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, loan.Customer.BranchId)) return NotFound();
        return Ok(MapTrail(loan));
    }

    private static LoanActivityTrailDto MapTrail(Loan loan)
    {
        var steps = BuildSteps(loan);
        return new LoanActivityTrailDto(
            loan.Id,
            loan.LoanNumber,
            loan.CustomerId,
            loan.Customer.FullName,
            !string.IsNullOrWhiteSpace(loan.Customer.ProfilePictureStoredFileName),
            loan.Amount,
            loan.Flow.Name,
            loan.CurrentStage.Name,
            loan.Status.ToString(),
            loan.CreatedAt,
            loan.CreatedByUser.FullName,
            steps);
    }

    /// <summary>
    /// Prefer persisted LoanActivity rows; fall back to synthesizing from create + approvals for older loans.
    /// </summary>
    private static IReadOnlyList<LoanActivityStepDto> BuildSteps(Loan loan)
    {
        if (loan.Activities.Count > 0)
        {
            return loan.Activities
                .OrderBy(a => a.OccurredAt)
                .ThenBy(a => a.Id)
                .Select(a => new LoanActivityStepDto(
                    a.Id,
                    a.Type.ToString(),
                    a.StageName,
                    a.ActorName,
                    a.Notes,
                    a.OccurredAt))
                .ToList();
        }

        // Legacy fallback for loans created before activity logging
        var steps = new List<LoanActivityStepDto>
        {
            new(
                0,
                LoanActivityType.ApplicationSubmitted.ToString(),
                "Application",
                loan.CreatedByUser.FullName,
                $"Loan application submitted ({loan.LoanNumber})",
                loan.CreatedAt),
        };

        var nextId = -1;
        foreach (var approval in loan.Approvals.OrderBy(a => a.RequestedAt).ThenBy(a => a.Id))
        {
            steps.Add(new LoanActivityStepDto(
                nextId--,
                LoanActivityType.ApprovalRequested.ToString(),
                approval.Stage?.Name ?? "Approval",
                null,
                $"Awaiting approval at {approval.Stage?.Name}",
                approval.RequestedAt));

            if (approval.Decision == ApprovalDecision.Pending) continue;

            steps.Add(new LoanActivityStepDto(
                nextId--,
                approval.Decision == ApprovalDecision.Approved
                    ? LoanActivityType.Approved.ToString()
                    : LoanActivityType.Declined.ToString(),
                approval.Stage?.Name ?? "Approval",
                approval.DecidedByUser?.FullName,
                approval.Comments,
                approval.DecidedAt ?? approval.RequestedAt));
        }

        if (loan.Status == LoanStatus.ApprovedFinal)
        {
            steps.Add(new LoanActivityStepDto(
                nextId--,
                LoanActivityType.ApprovedFinal.ToString(),
                loan.CurrentStage.Name,
                null,
                "Approved final — ready for payment terms",
                loan.UpdatedAt));
        }
        else if (loan.Status == LoanStatus.Closed)
        {
            steps.Add(new LoanActivityStepDto(
                nextId--,
                LoanActivityType.Closed.ToString(),
                loan.CurrentStage.Name,
                null,
                "Loan closed",
                loan.UpdatedAt));
        }
        else if (loan.Status == LoanStatus.Rejected)
        {
            steps.Add(new LoanActivityStepDto(
                nextId--,
                LoanActivityType.Rejected.ToString(),
                loan.CurrentStage.Name,
                null,
                "Loan rejected",
                loan.UpdatedAt));
        }
        else if (!loan.Approvals.Any(a => a.Decision == ApprovalDecision.Pending))
        {
            steps.Add(new LoanActivityStepDto(
                nextId,
                LoanActivityType.StageEntered.ToString(),
                loan.CurrentStage.Name,
                null,
                $"Current stage: {loan.CurrentStage.Name}",
                loan.UpdatedAt));
        }

        return steps;
    }
}
