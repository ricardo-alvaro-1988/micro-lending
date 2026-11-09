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
[Route("api/loans")]
[Authorize]
public class LoansController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly LoanWorkflowService _workflow;
    private readonly LoanFinanceService _finance;
    private readonly BranchScopeService _branchScope;

    public LoansController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        LoanWorkflowService workflow,
        LoanFinanceService finance,
        BranchScopeService branchScope)
    {
        _db = db;
        _userManager = userManager;
        _workflow = workflow;
        _finance = finance;
        _branchScope = branchScope;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.LoansView}")]
    public async Task<ActionResult<IEnumerable<LoanDto>>> GetAll(
        [FromQuery] int? customerId = null,
        [FromQuery] int? branchId = null)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        // List view: avoid ScheduleItems × Payments Include (cartesian explosion / hang).
        var query = BranchScopeService.Loans(
            _db.Loans
                .AsNoTracking()
                .Include(l => l.Customer)
                .Include(l => l.Flow)
                .Include(l => l.CurrentStage)
                .Include(l => l.CreatedByUser)
                .Include(l => l.LoanProduct)
                .AsQueryable(),
            scope);

        if (customerId is not null)
            query = query.Where(l => l.CustomerId == customerId);

        var loans = await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
        var loanIds = loans.Select(l => l.Id).ToList();
        var paidByLoan = loanIds.Count == 0
            ? new Dictionary<int, decimal>()
            : await _db.LoanPayments.AsNoTracking()
                .Where(p => loanIds.Contains(p.LoanId))
                .GroupBy(p => p.LoanId)
                .Select(g => new { LoanId = g.Key, Total = g.Sum(p => p.Amount) })
                .ToDictionaryAsync(x => x.LoanId, x => x.Total);

        var approverCtx = await _workflow.GetApproverContextAsync(user);
        var result = new List<LoanDto>(loans.Count);
        foreach (var loan in loans)
        {
            if (loan.CurrentStage is not null)
                await _workflow.EnsureStageApproversLoadedAsync(loan.CurrentStage);
            paidByLoan.TryGetValue(loan.Id, out var totalPaid);
            result.Add(MapLoan(loan, approverCtx, totalPaid));
        }
        return Ok(result);
    }

    /// <summary>Active loans (In Progress + Pending Approval) — for Loans menu badge / notifications.</summary>
    [HttpGet("pending/summary")]
    [Authorize(Policy = $"perm:{PermissionCodes.LoansView}")]
    public async Task<ActionResult<PendingLoanSummaryDto>> PendingSummary([FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var query = BranchScopeService.Loans(
            _db.Loans
                .AsNoTracking()
                .Include(l => l.Customer)
                .Include(l => l.CurrentStage)
                .Where(l =>
                    l.Status == LoanStatus.InProgress || l.Status == LoanStatus.PendingApproval),
            scope);

        var latest = await query
            .OrderByDescending(l => l.UpdatedAt)
            .Take(5)
            .Select(l => new PendingLoanItemDto(
                l.Id,
                l.LoanNumber,
                l.Customer.FullName,
                l.CurrentStage.Name,
                l.Amount,
                l.UpdatedAt))
            .ToListAsync();

        var count = await query.CountAsync();
        return Ok(new PendingLoanSummaryDto(count, latest));
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.LoansManage}")]
    public async Task<ActionResult<LoanDto>> Create([FromBody] CreateLoanRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var flow = await _db.ProcessFlows
            .Include(f => f.Stages)
            .FirstOrDefaultAsync(f => f.Id == request.FlowId && f.IsActive);
        if (flow is null) return BadRequest(new { message = "Active process flow not found." });

        var first = flow.Stages.OrderBy(s => s.SortOrder).FirstOrDefault();
        if (first is null) return BadRequest(new { message = "Process flow has no stages." });

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId);
        if (customer is null) return BadRequest(new { message = "Customer not found. Create the customer first." });
        if (!BranchScopeService.CanAccessCustomer(scope, customer))
            return BadRequest(new { message = "Customer is not available for your account." });

        if (!TryParseFrequency(request.PaymentFrequency, out var frequency))
            return BadRequest(new { message = "Payment frequency must be Daily, Weekly, BiWeekly, or Monthly." });
        if (!LoanFinanceService.TryParseInterestMethod(request.InterestMethod, out var interestMethod))
            return BadRequest(new { message = "Interest method must be Flat or DecliningBalance." });

        LoanProduct? product = null;
        if (request.LoanProductId is int productId)
        {
            product = await _db.LoanProducts.FirstOrDefaultAsync(p => p.Id == productId && p.IsActive);
            if (product is null)
                return BadRequest(new { message = "Loan product not found or inactive." });
            if (string.IsNullOrWhiteSpace(request.InterestMethod))
                interestMethod = product.InterestMethod;
        }

        var loan = new Loan
        {
            LoanNumber = $"LN-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}",
            CustomerId = customer.Id,
            FlowId = flow.Id,
            CurrentStageId = first.Id,
            LoanProductId = product?.Id,
            Notes = request.Notes?.Trim(),
            CreatedByUserId = user.Id,
            Status = LoanStatus.InProgress,
            InterestMethod = interestMethod,
        };

        try
        {
            if (request.TermCount > 0 && request.FirstDueDate is not null)
            {
                LoanFinanceService.ApplyTerms(
                    loan,
                    request.Amount,
                    request.InterestRatePercent,
                    request.TermCount,
                    frequency,
                    request.FirstDueDate,
                    interestMethod);
                _finance.RebuildSchedule(loan);
            }
            else
            {
                loan.Amount = decimal.Round(request.Amount, 2);
                loan.InterestRatePercent = decimal.Round(request.InterestRatePercent, 4);
                loan.TermCount = request.TermCount;
                loan.PaymentFrequency = frequency;
            }
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        _workflow.LogApplicationSubmitted(loan, first, user);
        _db.Loans.Add(loan);
        await _db.SaveChangesAsync();

        await _workflow.EnterStageAsync(loan, first, user, isInitial: true);
        await _db.SaveChangesAsync();

        loan = await _db.Loans
            .Include(l => l.Customer)
            .Include(l => l.Flow)
            .Include(l => l.CurrentStage)
            .Include(l => l.CreatedByUser)
            .Include(l => l.ScheduleItems)
            .Include(l => l.Payments)
            .Include(l => l.LoanProduct)
            .FirstAsync(l => l.Id == loan.Id);

        return CreatedAtAction(nameof(GetAll), await MapLoanAsync(loan, user));
    }

    [HttpPost("{id:int}/advance")]
    [Authorize(Policy = $"perm:{PermissionCodes.LoansManage}")]
    public async Task<ActionResult<LoanDto>> Advance(int id)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var loan = await _db.Loans
            .Include(l => l.Customer)
            .Include(l => l.Flow)
            .Include(l => l.CurrentStage)
            .Include(l => l.CreatedByUser)
            .Include(l => l.LoanProduct)
            .Include(l => l.ScheduleItems)
            .Include(l => l.Payments)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (loan is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, loan.Customer)) return NotFound();

        if (loan.Status is LoanStatus.Rejected or LoanStatus.Closed or LoanStatus.ApprovedFinal)
            return BadRequest(new { message = "Loan is already approved-final, closed, or rejected." });

        try
        {
            await _workflow.AdvanceAsync(loan, user);
            await _db.SaveChangesAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        await _db.Entry(loan).Reference(l => l.CurrentStage).LoadAsync();
        return Ok(await MapLoanAsync(loan, user));
    }

    private async Task<LoanDto> MapLoanAsync(Loan loan, ApplicationUser user)
    {
        if (loan.CurrentStage is not null)
            await _workflow.EnsureStageApproversLoadedAsync(loan.CurrentStage);
        var ctx = await _workflow.GetApproverContextAsync(user);
        var totalPaid = loan.Payments?.Sum(p => p.Amount) ?? 0;
        return MapLoan(loan, ctx, totalPaid);
    }

    private LoanDto MapLoan(Loan loan, ApproverContext ctx, decimal totalPaid)
    {
        var canApprove = loan.Status == LoanStatus.PendingApproval
            && _workflow.CanUserApproveStage(loan.CurrentStage, ctx);
        var canAdvance = loan.Status == LoanStatus.InProgress && !loan.CurrentStage.IsFinal;
        var remaining = Math.Max(0, loan.TotalPayable - totalPaid);

        return new LoanDto(
            loan.Id,
            loan.LoanNumber,
            loan.CustomerId,
            loan.Customer.FullName,
            loan.FlowId,
            loan.Flow.Name,
            loan.CurrentStageId,
            loan.CurrentStage.Name,
            loan.Amount,
            loan.InterestRatePercent,
            loan.TermCount,
            loan.PaymentFrequency.ToString(),
            loan.FirstDueDate,
            loan.InterestAmount,
            loan.TotalPayable,
            loan.InstallmentAmount,
            totalPaid,
            remaining,
            loan.Status.ToString(),
            loan.CreatedByUser.FullName,
            loan.Notes,
            loan.CreatedAt,
            canApprove,
            canAdvance,
            loan.TermCount > 0 && loan.FirstDueDate is not null,
            loan.LoanProductId,
            loan.LoanProduct?.Name,
            loan.InterestMethod.ToString());
    }

    private static bool TryParseFrequency(string? value, out PaymentFrequency frequency)
    {
        frequency = PaymentFrequency.Monthly;
        if (string.IsNullOrWhiteSpace(value)) return true;
        return Enum.TryParse(value.Replace("-", "").Replace(" ", ""), true, out frequency);
    }
}
