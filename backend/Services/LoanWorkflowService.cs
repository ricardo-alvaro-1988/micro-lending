using MicroLending.Api.Data;
using MicroLending.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Services;

public class LoanWorkflowService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public LoanWorkflowService(AppDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<ApproverContext> GetApproverContextAsync(ApplicationUser user)
    {
        var roleNames = await _userManager.GetRolesAsync(user);
        var roleIds = roleNames.Count == 0
            ? new List<string>()
            : await _db.Roles.AsNoTracking()
                .Where(r => roleNames.Contains(r.Name!))
                .Select(r => r.Id)
                .ToListAsync();

        return new ApproverContext(user.Id, roleIds);
    }

    public bool CanUserApproveStage(ProcessStage stage, ApproverContext ctx)
    {
        if (!stage.RequiresApproval) return false;

        if (!string.IsNullOrEmpty(stage.ApproverUserId) && stage.ApproverUserId == ctx.UserId)
            return true;

        if (!string.IsNullOrEmpty(stage.ApproverRoleId) && ctx.RoleIds.Contains(stage.ApproverRoleId))
            return true;

        return false;
    }

    public async Task<bool> CanUserApproveStageAsync(ApplicationUser user, ProcessStage stage)
    {
        var ctx = await GetApproverContextAsync(user);
        return CanUserApproveStage(stage, ctx);
    }

    public Task EnterStageAsync(Loan loan, ProcessStage stage, ApplicationUser? actor = null, bool isInitial = false)
    {
        loan.CurrentStageId = stage.Id;
        loan.CurrentStage = stage;
        loan.UpdatedAt = DateTime.UtcNow;

        // Final stage (Approved-Final) means the application is ready for payment terms / schedule.
        if (stage.IsFinal || IsApprovedFinalStage(stage.Name))
        {
            if (stage.RequiresApproval)
            {
                loan.Status = LoanStatus.PendingApproval;
                _db.LoanApprovals.Add(new LoanApproval
                {
                    LoanId = loan.Id,
                    StageId = stage.Id,
                    Decision = ApprovalDecision.Pending,
                    RequestedAt = DateTime.UtcNow
                });
                AddActivity(loan, LoanActivityType.ApprovalRequested, stage, actor, $"Awaiting approval at {stage.Name}");
                return Task.CompletedTask;
            }

            MarkApprovedFinal(loan, stage, actor);
            return Task.CompletedTask;
        }

        if (stage.RequiresApproval)
        {
            loan.Status = LoanStatus.PendingApproval;
            _db.LoanApprovals.Add(new LoanApproval
            {
                LoanId = loan.Id,
                StageId = stage.Id,
                Decision = ApprovalDecision.Pending,
                RequestedAt = DateTime.UtcNow
            });
            AddActivity(loan, LoanActivityType.ApprovalRequested, stage, actor, $"Awaiting approval at {stage.Name}");
        }
        else
        {
            loan.Status = LoanStatus.InProgress;
            if (!isInitial)
                AddActivity(loan, LoanActivityType.StageEntered, stage, actor, $"Entered {stage.Name}");
        }

        return Task.CompletedTask;
    }

    public void LogApplicationSubmitted(Loan loan, ProcessStage firstStage, ApplicationUser actor)
    {
        AddActivity(
            loan,
            LoanActivityType.ApplicationSubmitted,
            firstStage,
            actor,
            $"Loan application submitted ({loan.LoanNumber})");
    }

    public async Task AdvanceAsync(Loan loan, ApplicationUser? actor = null)
    {
        var current = await _db.ProcessStages.FirstAsync(s => s.Id == loan.CurrentStageId);
        if (loan.Status == LoanStatus.ApprovedFinal || current.IsFinal)
        {
            if (loan.Status != LoanStatus.ApprovedFinal)
                MarkApprovedFinal(loan, current, actor);
            return;
        }

        if (current.RequiresApproval && loan.Status == LoanStatus.PendingApproval)
            throw new InvalidOperationException("Current stage is waiting for approval.");

        var next = await ResolveApproveTargetAsync(current);
        if (next is null)
        {
            MarkApprovedFinal(loan, current, actor, "No further stages — approved final, ready for payment terms");
            return;
        }

        AddActivity(loan, LoanActivityType.Advanced, current, actor, $"Advanced from {current.Name}");
        await EnterStageAsync(loan, next, actor);
    }

    public async Task ApplyApprovalDecisionAsync(
        Loan loan,
        ProcessStage stage,
        bool approved,
        ApplicationUser? actor = null,
        string? comments = null)
    {
        if (actor is not null)
        {
            AddActivity(
                loan,
                approved ? LoanActivityType.Approved : LoanActivityType.Declined,
                stage,
                actor,
                comments);
        }

        // Any other pending approvals on this loan (stale) should not stay actionable.
        await CancelOtherPendingApprovalsAsync(loan.Id, stage.Id);

        if (approved)
        {
            // Approving the final / disbursement gate completes the application.
            if (stage.IsFinal || IsApprovedFinalStage(stage.Name))
            {
                MarkApprovedFinal(loan, stage, actor);
                return;
            }

            loan.Status = LoanStatus.InProgress;
            var next = await ResolveApproveTargetAsync(stage);
            if (next is null)
            {
                MarkApprovedFinal(loan, stage, actor, "Approved with no further stages — ready for payment terms");
                return;
            }

            await EnterStageAsync(loan, next, actor);
            return;
        }

        if (stage.OnDeclineStageId is null)
        {
            loan.Status = LoanStatus.Rejected;
            loan.UpdatedAt = DateTime.UtcNow;
            AddActivity(loan, LoanActivityType.Rejected, stage, actor, "Loan rejected");
            return;
        }

        var declineTarget = await _db.ProcessStages.FirstOrDefaultAsync(s =>
            s.Id == stage.OnDeclineStageId && s.FlowId == loan.FlowId);
        if (declineTarget is null)
        {
            loan.Status = LoanStatus.Rejected;
            loan.UpdatedAt = DateTime.UtcNow;
            AddActivity(loan, LoanActivityType.Rejected, stage, actor, "Loan rejected");
            return;
        }

        await EnterStageAsync(loan, declineTarget, actor);
    }

    private async Task CancelOtherPendingApprovalsAsync(int loanId, int keepStageId)
    {
        var stale = await _db.LoanApprovals
            .Where(a => a.LoanId == loanId && a.Decision == ApprovalDecision.Pending && a.StageId != keepStageId)
            .ToListAsync();
        foreach (var item in stale)
        {
            item.Decision = ApprovalDecision.Rejected;
            item.Comments = "Superseded by a later workflow decision.";
            item.DecidedAt = DateTime.UtcNow;
        }
    }

    private void MarkApprovedFinal(Loan loan, ProcessStage stage, ApplicationUser? actor, string? notes = null)
    {
        loan.Status = LoanStatus.ApprovedFinal;
        loan.UpdatedAt = DateTime.UtcNow;
        AddActivity(
            loan,
            LoanActivityType.ApprovedFinal,
            stage,
            actor,
            notes ?? $"Approved final at {stage.Name} — ready for payment terms / schedule");
    }

    /// <summary>Stages named Approved-Final (or legacy Closed) complete the application.</summary>
    public static bool IsApprovedFinalStage(string? stageName)
    {
        if (string.IsNullOrWhiteSpace(stageName)) return false;
        var key = stageName.Replace(" ", "").Replace("-", "").Replace("_", "");
        return key.Equals("ApprovedFinal", StringComparison.OrdinalIgnoreCase)
               || key.Equals("Closed", StringComparison.OrdinalIgnoreCase);
    }

    private void AddActivity(
        Loan loan,
        LoanActivityType type,
        ProcessStage stage,
        ApplicationUser? actor,
        string? notes)
    {
        var activity = new LoanActivity
        {
            Type = type,
            StageId = stage.Id,
            StageName = stage.Name,
            ActorUserId = actor?.Id,
            ActorName = actor?.FullName,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            OccurredAt = DateTime.UtcNow,
        };

        if (loan.Id == 0)
        {
            loan.Activities.Add(activity);
        }
        else
        {
            activity.LoanId = loan.Id;
            _db.LoanActivities.Add(activity);
        }
    }

    private async Task<ProcessStage?> ResolveApproveTargetAsync(ProcessStage current)
    {
        if (current.OnApproveStageId is int approveId)
        {
            return await _db.ProcessStages.FirstOrDefaultAsync(s =>
                s.Id == approveId && s.FlowId == current.FlowId);
        }

        return await _db.ProcessStages
            .Where(s => s.FlowId == current.FlowId && s.SortOrder > current.SortOrder)
            .OrderBy(s => s.SortOrder)
            .FirstOrDefaultAsync();
    }
}

public sealed record ApproverContext(string UserId, IReadOnlyList<string> RoleIds);
