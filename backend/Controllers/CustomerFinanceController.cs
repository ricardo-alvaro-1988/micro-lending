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
    private readonly SavingsLedgerService _savings;
    private readonly BranchScopeService _branchScope;

    public CustomerFinanceController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        LoanWorkflowService workflow,
        LoanFinanceService finance,
        SavingsLedgerService savings,
        BranchScopeService branchScope)
    {
        _db = db;
        _userManager = userManager;
        _workflow = workflow;
        _finance = finance;
        _savings = savings;
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
        // Eager-load stage approvers (avoid N+1 LoadAsync on AsNoTracking stages).
        var loans = await _db.Loans
            .AsNoTracking()
            .Include(l => l.Customer)
            .Include(l => l.Flow)
            .Include(l => l.CurrentStage)!.ThenInclude(s => s!.ApproverRoles)
            .Include(l => l.CurrentStage)!.ThenInclude(s => s!.ApproverUsers)
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

    /// <summary>Lightweight loan picker (id + number) for statement/filters — no approver graph.</summary>
    [HttpGet("loan-options")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersView}")]
    public async Task<ActionResult<IEnumerable<object>>> LoanOptions(int customerId)
    {
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var list = await _db.Loans.AsNoTracking()
            .Where(l => l.CustomerId == customerId)
            .OrderBy(l => l.Amount)
            .ThenByDescending(l => l.CreatedAt)
            .Select(l => new { l.Id, l.LoanNumber, Status = l.Status.ToString() })
            .ToListAsync();
        return Ok(list);
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
            var charges = LoanChargeMapping.WithMembershipForCycle(
                LoanChargeMapping.Resolve(
                    request,
                    request.LoanProductId is int pid
                        ? await _db.LoanProducts.FirstOrDefaultAsync(p => p.Id == pid)
                        : loan.LoanProduct),
                loan.Cycle);
            LoanFinanceService.ApplyTerms(
                loan,
                request.Amount,
                request.InterestRatePercent,
                request.TermCount,
                frequency,
                request.FirstDueDate,
                interestMethod,
                charges);
            loan.Notes = string.IsNullOrWhiteSpace(request.Notes) ? loan.Notes : request.Notes.Trim();
            _finance.RebuildSchedule(loan);
            await _savings.EnsurePrimaryFromInitialAsync(loan, user.Id);
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
            var method = string.IsNullOrWhiteSpace(request.Method)
                ? (canField && !canOffice ? "Cash" : null)
                : request.Method.Trim();
            var payment = new LoanPayment
            {
                Amount = decimal.Round(request.Amount, 2),
                PaidAt = (request.PaidAt ?? DateTime.UtcNow).ToUniversalTime(),
                Method = method,
                Reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim(),
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                RecordedByUserId = user.Id,
                CreatedAt = DateTime.UtcNow,
            };
            loan.Payments.Add(payment);

            var (_, extraOffset, _) = await _finance.ApplyPaymentAsync(
                loan,
                request.Amount,
                request.UseExtraSavings,
                user.Id,
                payment);

            if (extraOffset > 0)
            {
                var note = $"Extra savings offset {extraOffset:0.00}";
                payment.Notes = string.IsNullOrWhiteSpace(payment.Notes) ? note : $"{payment.Notes}; {note}";
            }

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

    [HttpGet("loans/{loanId:int}/savings-transactions")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersView}")]
    public async Task<ActionResult<IEnumerable<SavingsTransactionDto>>> GetSavingsTransactions(
        int customerId,
        int loanId,
        [FromQuery] string? kind = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;
        var loan = await _db.Loans.AsNoTracking().FirstOrDefaultAsync(l => l.Id == loanId && l.CustomerId == customerId);
        if (loan is null) return NotFound();

        var q = _db.SavingsTransactions.AsNoTracking()
            .Include(t => t.Customer)
            .Include(t => t.Loan)
            .Include(t => t.RecordedByUser)
            .Where(t => t.LoanId == loanId);

        if (!string.IsNullOrWhiteSpace(kind)
            && Enum.TryParse<SavingsKind>(kind, true, out var kindEnum))
            q = q.Where(t => t.Kind == kindEnum);
        if (from is DateTime f) q = q.Where(t => t.OccurredAt >= f.Date);
        if (to is DateTime tto) q = q.Where(t => t.OccurredAt < tto.Date.AddDays(1));

        var rows = await q.OrderByDescending(t => t.OccurredAt).ThenByDescending(t => t.Id).ToListAsync();
        return Ok(rows.Select(t => new SavingsTransactionDto(
            t.Id,
            t.CustomerId,
            t.Customer.FullName,
            t.LoanId,
            t.Loan.LoanNumber,
            t.Kind.ToString(),
            t.Type.ToString(),
            t.Amount,
            t.BalanceAfter,
            t.OccurredAt,
            t.Notes,
            t.RecordedByUser?.FullName)));
    }

    [HttpPost("loans/{loanId:int}/extra-savings")]
    [Authorize]
    public async Task<ActionResult<object>> DepositExtraSavings(
        int customerId,
        int loanId,
        [FromBody] ExtraSavingsDepositRequest request)
    {
        var canOffice = User.HasClaim("permission", PermissionCodes.LoansManage);
        var canField = User.HasClaim("permission", PermissionCodes.FieldCollect);
        if (!canOffice && !canField) return Forbid();

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var loan = await _db.Loans.FirstOrDefaultAsync(l => l.Id == loanId && l.CustomerId == customerId);
        if (loan is null) return NotFound();

        try
        {
            _savings.Post(
                loan,
                SavingsKind.Extra,
                SavingsTransactionType.ExtraDeposit,
                request.Amount,
                user.Id,
                notes: request.Notes,
                occurredAt: request.OccurredAt?.ToUniversalTime());
            loan.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        return Ok(new
        {
            loan.PrimarySavingsBalance,
            loan.ExtraSavingsBalance,
        });
    }

    [HttpPost("loans/{loanId:int}/late-fees")]
    [Authorize(Policy = $"perm:{PermissionCodes.LoansManage}")]
    public async Task<ActionResult<LoanLateFeeDto>> PostLateFee(
        int customerId,
        int loanId,
        [FromBody] ManualLateFeeRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (await EnsureCustomerAccessAsync(customerId) is { } denied) return denied;

        var loan = await _db.Loans.FirstOrDefaultAsync(l => l.Id == loanId && l.CustomerId == customerId);
        if (loan is null) return NotFound();
        if (loan.Status is not (LoanStatus.ApprovedFinal or LoanStatus.Closed))
            return BadRequest(new { message = "Late fees can only be added on approved or closed loans." });
        if (request.Amount <= 0)
            return BadRequest(new { message = "Late fee amount must be greater than zero." });

        var occurredAt = request.OccurredAt?.ToUniversalTime() ?? DateTime.UtcNow;
        var fee = new LoanLateFee
        {
            LoanId = loan.Id,
            Amount = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero),
            OccurredAt = occurredAt,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            RecordedByUserId = user.Id,
            CreatedAt = DateTime.UtcNow,
        };
        _db.LoanLateFees.Add(fee);
        loan.TotalPayable += fee.Amount;
        loan.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new LoanLateFeeDto(
            fee.Id,
            loan.Id,
            loan.LoanNumber,
            fee.Amount,
            fee.OccurredAt,
            fee.Notes,
            user.FullName));
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
            .Include(l => l.CurrentStage)!.ThenInclude(s => s!.ApproverRoles)
            .Include(l => l.CurrentStage)!.ThenInclude(s => s!.ApproverUsers)
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

        // Only booked liabilities: Approved-Final / Closed. Applications still in process or rejected
        // must not appear as charges on the statement of account.
        var loanRows = await _db.Loans.AsNoTracking()
            .Where(l => l.CustomerId == customerId && (loanId == null || l.Id == loanId))
            .Where(l => l.Status == LoanStatus.ApprovedFinal || l.Status == LoanStatus.Closed)
            .Where(l => l.TotalPayable > 0)
            .OrderBy(l => l.CreatedAt)
            .Select(l => new { l.Id, l.LoanNumber, l.TotalPayable, l.CreatedAt, l.UpdatedAt })
            .ToListAsync();
        if (loanId is not null && loanRows.Count == 0)
        {
            // Loan exists but is not yet a booked receivable (or wrong customer).
            var exists = await _db.Loans.AsNoTracking()
                .AnyAsync(l => l.Id == loanId && l.CustomerId == customerId);
            if (!exists) return NotFound();
        }

        var loanIds = loanRows.Select(l => l.Id).ToList();
        var chargeDates = loanIds.Count == 0
            ? new Dictionary<int, DateTime>()
            : await _db.LoanActivities.AsNoTracking()
                .Where(a => loanIds.Contains(a.LoanId) && a.Type == LoanActivityType.ApprovedFinal)
                .GroupBy(a => a.LoanId)
                .Select(g => new { LoanId = g.Key, At = g.Min(x => x.OccurredAt) })
                .ToDictionaryAsync(x => x.LoanId, x => x.At);

        var payments = loanIds.Count == 0
            ? new List<(int LoanId, DateTime PaidAt, decimal Amount, string? Reference, int Id)>()
            : (await _db.LoanPayments.AsNoTracking()
                .Where(p => loanIds.Contains(p.LoanId))
                .OrderBy(p => p.PaidAt)
                .ThenBy(p => p.Id)
                .Select(p => new { p.LoanId, p.PaidAt, p.Amount, p.Reference, p.Id })
                .ToListAsync())
              .Select(p => (p.LoanId, p.PaidAt, p.Amount, p.Reference, p.Id))
              .ToList();
        var paymentsByLoan = payments.GroupBy(p => p.LoanId).ToDictionary(g => g.Key, g => g.ToList());

        var lateFees = loanIds.Count == 0
            ? new List<(int LoanId, DateTime OccurredAt, decimal Amount, string? Notes)>()
            : (await _db.LoanLateFees.AsNoTracking()
                .Where(f => loanIds.Contains(f.LoanId))
                .OrderBy(f => f.OccurredAt)
                .ThenBy(f => f.Id)
                .Select(f => new { f.LoanId, f.OccurredAt, f.Amount, f.Notes })
                .ToListAsync())
              .Select(f => (f.LoanId, f.OccurredAt, f.Amount, f.Notes))
              .ToList();
        var lateFeesByLoan = lateFees.GroupBy(f => f.LoanId).ToDictionary(g => g.Key, g => g.ToList());
        var lateFeeTotals = lateFeesByLoan.ToDictionary(kv => kv.Key, kv => kv.Value.Sum(f => f.Amount));

        DateTime? rangeStart = from?.Date;
        DateTime? rangeEndExclusive = to?.Date.AddDays(1);

        var lines = new List<StatementLineDto>();
        foreach (var loan in loanRows)
        {
            var chargeAt = chargeDates.TryGetValue(loan.Id, out var approvedAt)
                ? approvedAt
                : loan.UpdatedAt;

            // TotalPayable includes manual late fees; keep principal+interest as Charge and list LateFee lines separately.
            var lateFeeTotal = lateFeeTotals.GetValueOrDefault(loan.Id);
            var principalCharge = Math.Max(0, loan.TotalPayable - lateFeeTotal);
            lines.Add(new StatementLineDto(
                chargeAt,
                "Charge",
                $"Loan {loan.LoanNumber} principal + interest",
                principalCharge,
                0,
                0));

            if (lateFeesByLoan.TryGetValue(loan.Id, out var feesForLoan))
            {
                foreach (var fee in feesForLoan)
                {
                    lines.Add(new StatementLineDto(
                        fee.OccurredAt,
                        "LateFee",
                        $"Late fee on {loan.LoanNumber}"
                            + (string.IsNullOrWhiteSpace(fee.Notes) ? "" : $" — {fee.Notes}"),
                        fee.Amount,
                        0,
                        0));
                }
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

        if (loanIds.Count > 0)
        {
            var savingsTx = await _db.SavingsTransactions.AsNoTracking()
                .Where(t => loanIds.Contains(t.LoanId))
                .OrderBy(t => t.OccurredAt)
                .ThenBy(t => t.Id)
                .Select(t => new { t.LoanId, t.OccurredAt, t.Kind, t.Type, t.Amount, t.Notes, t.BalanceAfter })
                .ToListAsync();
            var loanNumbers = loanRows.ToDictionary(l => l.Id, l => l.LoanNumber);
            foreach (var t in savingsTx)
            {
                var loanNo = loanNumbers.GetValueOrDefault(t.LoanId) ?? $"#{t.LoanId}";
                var typeLabel = t.Kind == SavingsKind.Primary ? "PrimarySavings" : "ExtraSavings";
                var kindWord = t.Kind == SavingsKind.Primary ? "Primary savings" : "Extra savings";
                var reason = t.Type switch
                {
                    SavingsTransactionType.InitialSavings => "Initial savings",
                    SavingsTransactionType.DailySavings => "Daily savings",
                    SavingsTransactionType.ExtraDeposit => "Extra deposit",
                    SavingsTransactionType.UnderpayOffset => "Underpay offset",
                    SavingsTransactionType.ManualAdjust => "Manual adjustment",
                    _ => t.Type.ToString()
                };
                var desc = $"{kindWord} · {reason} on {loanNo} (bal {t.BalanceAfter:0.00})"
                    + (string.IsNullOrWhiteSpace(t.Notes) ? "" : $" — {t.Notes}");
                // Display amount on statement; does not affect loan receivable balance.
                var debit = t.Amount < 0 ? Math.Abs(t.Amount) : 0m;
                var credit = t.Amount > 0 ? t.Amount : 0m;
                lines.Add(new StatementLineDto(t.OccurredAt, typeLabel, desc, debit, credit, 0));
            }
        }

        static int LineSort(string type) => type switch
        {
            "Charge" => 0,
            "LateFee" => 1,
            "Payment" => 2,
            "PrimarySavings" => 3,
            "ExtraSavings" => 4,
            _ => 5
        };

        static bool AffectsLoanBalance(string type) =>
            type is "Charge" or "LateFee" or "Payment";

        lines = lines.OrderBy(l => l.Date).ThenBy(l => LineSort(l.Type)).ToList();
        decimal balance = 0;
        decimal opening = 0;
        var ordered = new List<StatementLineDto>();
        foreach (var line in lines)
        {
            var inRange = (!rangeStart.HasValue || line.Date >= rangeStart.Value)
                          && (!rangeEndExclusive.HasValue || line.Date < rangeEndExclusive.Value);
            if (!inRange)
            {
                if (rangeStart.HasValue && line.Date < rangeStart.Value && AffectsLoanBalance(line.Type))
                    opening += line.Debit - line.Credit;
                continue;
            }

            if (ordered.Count == 0 && rangeStart.HasValue)
                balance = opening;

            if (AffectsLoanBalance(line.Type))
                balance += line.Debit - line.Credit;
            ordered.Add(line with { Balance = balance });
        }

        if (ordered.Count == 0 && rangeStart.HasValue)
            balance = opening;

        var customerName = await _db.Customers.AsNoTracking()
            .Where(c => c.Id == customerId)
            .Select(c => c.FullName)
            .FirstAsync();

        return Ok(new StatementOfAccountDto(
            customerId,
            customerName,
            loanId,
            loanId is null ? null : loanRows.FirstOrDefault()?.LoanNumber,
            DateTime.UtcNow,
            opening,
            balance,
            ordered));
    }

    private async Task<LoanDto> MapLoanAsync(Loan loan, ApplicationUser user)
    {
        if (loan.CurrentStage is not null)
            await _workflow.EnsureStageApproversLoadedAsync(loan.CurrentStage);
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
            loan.InterestMethod.ToString(),
            loan.InsuranceAmount,
            loan.InitialSavings,
            loan.SavingsPerPeriod,
            loan.InsurancePerPeriod,
            loan.MembershipFee,
            loan.ProcessingFee,
            loan.LoanRedemptionFee,
            loan.Taxes,
            loan.NotarialFee,
            loan.Raffle,
            loan.TotalDeductions,
            loan.NetProceeds,
            loan.LoanType,
            loan.ApplicationType,
            loan.Cycle,
            loan.ApprovedAmount,
            CustomerMapping.MapCollaterals(loan.Collaterals ?? Array.Empty<LoanCollateral>()),
            loan.PrimarySavingsBalance,
            loan.ExtraSavingsBalance);
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
                s.SavingsPortion,
                s.InsurancePortion,
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
