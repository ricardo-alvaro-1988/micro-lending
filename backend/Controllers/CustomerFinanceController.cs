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
[Route("api/customers/{customerId:int}")]
[Authorize]
public class CustomerFinanceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly LoanWorkflowService _workflow;
    private readonly LoanFinanceService _finance;
    private readonly BranchScopeService _branchScope;

    public CustomerFinanceController(
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

    private async Task<ActionResult?> EnsureCustomerAccessAsync(int customerId)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();
        var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == customerId);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();
        return null;
    }

    [HttpGet("loans")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersView}")]
    public async Task<ActionResult<IEnumerable<LoanDto>>> GetLoans(int customerId)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        // List view: skip ScheduleItems × Payments Include to avoid cartesian hang.
        var loans = await _db.Loans
            .AsNoTracking()
            .Include(l => l.Customer)
            .Include(l => l.Flow)
            .Include(l => l.CurrentStage)
            .Include(l => l.CreatedByUser)
            .Include(l => l.LoanProduct)
            .Where(l => l.CustomerId == customerId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

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
            paidByLoan.TryGetValue(loan.Id, out var totalPaid);
            result.Add(MapLoan(loan, approverCtx, totalPaid));
        }
        return Ok(result);
    }

    [HttpGet("loans/{loanId:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersView}")]
    public async Task<ActionResult<object>> GetLoanDetail(int customerId, int loanId)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var loan = await _finance.LoadLoanFinanceAsync(loanId);
        if (loan is null || loan.CustomerId != customerId) return NotFound();

        await _finance.AccruePenaltiesAsync(loan);
        await _db.SaveChangesAsync();
        return Ok(new
        {
            loan = await MapLoanAsync(loan, user),
            schedule = MapSchedule(loan),
            payments = MapPayments(loan),
            approvals = MapApprovals(loan),
        });
    }

    [HttpPut("loans/{loanId:int}/terms")]
    [Authorize(Policy = $"perm:{PermissionCodes.LoansManage}")]
    public async Task<ActionResult<object>> UpdateTerms(int customerId, int loanId, [FromBody] UpdateLoanTermsRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var loan = await _finance.LoadLoanFinanceAsync(loanId);
        if (loan is null || loan.CustomerId != customerId) return NotFound();

        // Payment terms / schedule start once the loan is Approved-Final (Closed kept for legacy rows).
        if (loan.Status is not (LoanStatus.ApprovedFinal or LoanStatus.Closed))
            return BadRequest(new { message = "Payment terms are available after the loan reaches Approved-Final." });
        if (loan.Payments.Any())
            return BadRequest(new { message = "Cannot change terms after payments have been recorded." });

        if (!TryParseFrequency(request.PaymentFrequency, out var frequency))
            return BadRequest(new { message = "Payment frequency must be Daily, Weekly, BiWeekly, or Monthly." });
        if (!LoanFinanceService.TryParseInterestMethod(request.InterestMethod, out var interestMethod))
            return BadRequest(new { message = "Interest method must be Flat or DecliningBalance." });

        if (request.LoanProductId is int productId)
        {
            var product = await _db.LoanProducts.FirstOrDefaultAsync(p => p.Id == productId);
            if (product is null) return BadRequest(new { message = "Loan product not found." });
            if (!product.IsActive && loan.LoanProductId != product.Id)
                return BadRequest(new { message = "Selected loan product is inactive." });
            loan.LoanProductId = product.Id;
            if (string.IsNullOrWhiteSpace(request.InterestMethod))
                interestMethod = product.InterestMethod;
        }
        else
        {
            loan.LoanProductId = null;
        }

        try
        {
            LoanFinanceService.ApplyTerms(
                loan,
                request.Amount,
                request.InterestRatePercent,
                request.TermCount,
                frequency,
                request.FirstDueDate,
                interestMethod);
            loan.Notes = string.IsNullOrWhiteSpace(request.Notes) ? loan.Notes : request.Notes.Trim();
            _finance.RebuildSchedule(loan);
            await _db.SaveChangesAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        return Ok(new
        {
            loan = await MapLoanAsync(loan, user),
            schedule = MapSchedule(loan),
        });
    }

    [HttpPost("loans/{loanId:int}/payments")]
    [Authorize]
    public async Task<ActionResult<object>> RecordPayment(int customerId, int loanId, [FromBody] RecordLoanPaymentRequest request)
    {
        var canOffice = User.HasClaim("permission", PermissionCodes.LoansManage);
        var canField = User.HasClaim("permission", PermissionCodes.FieldCollect);
        if (!canOffice && !canField) return Forbid();

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var loan = await _finance.LoadLoanFinanceAsync(loanId);
        if (loan is null || loan.CustomerId != customerId) return NotFound();
        if (!loan.ScheduleItems.Any())
            return BadRequest(new { message = "Set payment terms and generate a schedule before recording payments." });

        try
        {
            await _finance.ApplyPaymentAsync(loan, request.Amount);
            var method = string.IsNullOrWhiteSpace(request.Method)
                ? (canField && !canOffice ? "Cash" : null)
                : request.Method.Trim();
            loan.Payments.Add(new LoanPayment
            {
                Amount = decimal.Round(request.Amount, 2),
                PaidAt = (request.PaidAt ?? DateTime.UtcNow).ToUniversalTime(),
                Method = method,
                Reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim(),
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                RecordedByUserId = user.Id,
                CreatedAt = DateTime.UtcNow,
            });
            loan.UpdatedAt = DateTime.UtcNow;
            _finance.TryMatureIfFullyPaid(loan, user);
            await _db.SaveChangesAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        await _db.Entry(loan).Collection(l => l.Payments).Query().Include(p => p.RecordedByUser).LoadAsync();
        if (loan.CurrentStage is null)
            await _db.Entry(loan).Reference(l => l.CurrentStage).LoadAsync();

        return Ok(new
        {
            loan = await MapLoanAsync(loan, user),
            schedule = MapSchedule(loan),
            payments = MapPayments(loan),
        });
    }

    [HttpGet("payment-summary")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersView}")]
    public async Task<ActionResult<CustomerPaymentSummaryDto>> PaymentSummary(int customerId)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == customerId);
        if (customer is null) return NotFound();

        // Avoid ScheduleItems × Payments Include (cartesian explosion / hang).
        var loans = await _db.Loans
            .AsNoTracking()
            .Include(l => l.Customer)
            .Include(l => l.Flow)
            .Include(l => l.CurrentStage)
            .Include(l => l.CreatedByUser)
            .Include(l => l.LoanProduct)
            .Where(l => l.CustomerId == customerId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        var loanIds = loans.Select(l => l.Id).ToList();
        var paidByLoan = loanIds.Count == 0
            ? new Dictionary<int, decimal>()
            : await _db.LoanPayments.AsNoTracking()
                .Where(p => loanIds.Contains(p.LoanId))
                .GroupBy(p => p.LoanId)
                .Select(g => new { LoanId = g.Key, Total = g.Sum(p => p.Amount) })
                .ToDictionaryAsync(x => x.LoanId, x => x.Total);

        var today = DateTime.UtcNow.Date;
        decimal overdueAmount = 0;
        var overdueCount = 0;
        if (loanIds.Count > 0)
        {
            var scheduleRows = await _db.LoanScheduleItems.AsNoTracking()
                .Where(s => loanIds.Contains(s.LoanId))
                .Select(s => new { s.AmountDue, s.PenaltyAmount, s.PaidAmount, s.DueDate })
                .ToListAsync();
            foreach (var item in scheduleRows)
            {
                var remaining = item.AmountDue + item.PenaltyAmount - item.PaidAmount;
                if (remaining <= 0) continue;
                if (item.DueDate.Date >= today) continue;
                overdueAmount += remaining;
                overdueCount++;
            }
        }

        var approverCtx = await _workflow.GetApproverContextAsync(user);
        var mapped = new List<LoanDto>(loans.Count);
        foreach (var loan in loans)
        {
            paidByLoan.TryGetValue(loan.Id, out var totalPaid);
            mapped.Add(MapLoan(loan, approverCtx, totalPaid));
        }

        return Ok(new CustomerPaymentSummaryDto(
            customer.Id,
            customer.FullName,
            mapped.Count,
            mapped.Sum(l => l.Amount),
            mapped.Sum(l => l.TotalPayable),
            mapped.Sum(l => l.TotalPaid),
            mapped.Sum(l => l.RemainingBalance),
            overdueAmount,
            overdueCount,
            mapped));
    }

    [HttpGet("statement")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersView}")]
    public async Task<ActionResult<StatementOfAccountDto>> Statement(
        int customerId,
        [FromQuery] int? loanId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var loanQuery = _db.Loans
            .AsNoTracking()
            .Include(l => l.Customer)
            .Where(l => l.CustomerId == customerId);
        if (loanId is not null) loanQuery = loanQuery.Where(l => l.Id == loanId);

        var loans = await loanQuery.OrderBy(l => l.CreatedAt).ToListAsync();
        if (loanId is not null && loans.Count == 0) return NotFound();

        var loanIds = loans.Select(l => l.Id).ToList();
        var payments = loanIds.Count == 0
            ? new List<LoanPayment>()
            : await _db.LoanPayments.AsNoTracking()
                .Where(p => loanIds.Contains(p.LoanId))
                .OrderBy(p => p.PaidAt)
                .ThenBy(p => p.Id)
                .ToListAsync();
        var paymentsByLoan = payments.GroupBy(p => p.LoanId).ToDictionary(g => g.Key, g => g.ToList());

        DateTime? rangeStart = from?.Date;
        DateTime? rangeEndExclusive = to?.Date.AddDays(1);

        var lines = new List<StatementLineDto>();
        foreach (var loan in loans)
        {
            if (loan.TotalPayable > 0)
            {
                lines.Add(new StatementLineDto(
                    loan.CreatedAt,
                    "Charge",
                    $"Loan {loan.LoanNumber} principal + interest",
                    loan.TotalPayable,
                    0,
                    0));
            }

            if (!paymentsByLoan.TryGetValue(loan.Id, out var loanPayments)) continue;
            foreach (var payment in loanPayments)
            {
                lines.Add(new StatementLineDto(
                    payment.PaidAt,
                    "Payment",
                    $"Payment on {loan.LoanNumber}" + (string.IsNullOrWhiteSpace(payment.Reference) ? "" : $" ({payment.Reference})"),
                    0,
                    payment.Amount,
                    0));
            }
        }

        lines = lines.OrderBy(l => l.Date).ThenBy(l => l.Type == "Charge" ? 0 : 1).ToList();
        decimal balance = 0;
        decimal opening = 0;
        var ordered = new List<StatementLineDto>();
        foreach (var line in lines)
        {
            var inRange = (!rangeStart.HasValue || line.Date >= rangeStart.Value)
                          && (!rangeEndExclusive.HasValue || line.Date < rangeEndExclusive.Value);
            if (!inRange)
            {
                if (rangeStart.HasValue && line.Date < rangeStart.Value)
                    opening += line.Debit - line.Credit;
                continue;
            }

            if (ordered.Count == 0 && rangeStart.HasValue)
                balance = opening;

            balance += line.Debit - line.Credit;
            ordered.Add(line with { Balance = balance });
        }

        if (ordered.Count == 0 && rangeStart.HasValue)
            balance = opening;

        var customerName = loans.FirstOrDefault()?.Customer.FullName
            ?? (await _db.Customers.AsNoTracking().FirstAsync(c => c.Id == customerId)).FullName;

        return Ok(new StatementOfAccountDto(
            customerId,
            customerName,
            loanId,
            loanId is null ? null : loans.FirstOrDefault()?.LoanNumber,
            DateTime.UtcNow,
            opening,
            balance,
            ordered));
    }

    private async Task<LoanDto> MapLoanAsync(Loan loan, ApplicationUser user)
    {
        var totalPaid = loan.Payments?.Sum(p => p.Amount) ?? 0;
        var ctx = await _workflow.GetApproverContextAsync(user);
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

    private static IReadOnlyList<LoanScheduleItemDto> MapSchedule(Loan loan) =>
        loan.ScheduleItems
            .OrderBy(s => s.InstallmentNumber)
            .Select(s => new LoanScheduleItemDto(
                s.Id,
                s.InstallmentNumber,
                s.DueDate,
                s.AmountDue,
                s.PrincipalPortion,
                s.InterestPortion,
                s.PenaltyAmount,
                s.PaidAmount,
                LoanFinanceService.ItemBalance(s),
                s.Status.ToString()))
            .ToList();

    private static IReadOnlyList<LoanPaymentDto> MapPayments(Loan loan) =>
        loan.Payments
            .OrderByDescending(p => p.PaidAt)
            .ThenByDescending(p => p.Id)
            .Select(p => new LoanPaymentDto(
                p.Id,
                p.Amount,
                p.PaidAt,
                p.Method,
                p.Reference,
                p.Notes,
                p.RecordedByUser?.FullName ?? "",
                p.CreatedAt))
            .ToList();

    private static IReadOnlyList<LoanApprovalHistoryDto> MapApprovals(Loan loan) =>
        loan.Approvals
            .OrderByDescending(a => a.RequestedAt)
            .Select(a => new LoanApprovalHistoryDto(
                a.Id,
                a.Stage?.Name ?? "",
                a.Decision.ToString(),
                a.DecidedByUser?.FullName,
                a.Comments,
                a.RequestedAt,
                a.DecidedAt))
            .ToList();

    private static bool TryParseFrequency(string? value, out PaymentFrequency frequency)
    {
        frequency = PaymentFrequency.Monthly;
        if (string.IsNullOrWhiteSpace(value)) return true;
        return Enum.TryParse(value.Replace("-", "").Replace(" ", ""), true, out frequency);
    }
}
