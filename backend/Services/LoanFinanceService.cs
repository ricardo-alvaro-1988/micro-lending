using MicroLending.Api.Data;
using MicroLending.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Services;

public class LoanFinanceService
{
    private readonly AppDbContext _db;
    private LateFeeSettings? _cachedLateFees;

    public LoanFinanceService(AppDbContext db) => _db = db;

    public static decimal ItemTotalDue(LoanScheduleItem item) => item.AmountDue + item.PenaltyAmount;

    public static decimal ItemBalance(LoanScheduleItem item) =>
        Math.Max(0, ItemTotalDue(item) - item.PaidAmount);

    public static void ApplyTerms(
        Loan loan,
        decimal principal,
        decimal interestRatePercent,
        int termCount,
        PaymentFrequency frequency,
        DateTime? firstDueDate,
        InterestMethod interestMethod = InterestMethod.Flat)
    {
        if (principal <= 0) throw new InvalidOperationException("Principal amount must be greater than zero.");
        if (interestRatePercent < 0) throw new InvalidOperationException("Interest rate cannot be negative.");
        if (termCount <= 0) throw new InvalidOperationException("Term count must be at least 1.");

        loan.Amount = decimal.Round(principal, 2);
        loan.InterestRatePercent = decimal.Round(interestRatePercent, 4);
        loan.TermCount = termCount;
        loan.PaymentFrequency = frequency;
        loan.InterestMethod = interestMethod;
        loan.FirstDueDate = firstDueDate?.Date;

        var portions = ComputeSchedulePortions(loan.Amount, loan.InterestRatePercent, termCount, interestMethod);
        loan.InterestAmount = portions.Sum(p => p.Interest);
        loan.TotalPayable = portions.Sum(p => p.AmountDue);
        loan.InstallmentAmount = interestMethod == InterestMethod.DecliningBalance
            ? (portions.Count > 0 ? portions[0].AmountDue : 0)
            : decimal.Round(loan.TotalPayable / termCount, 2);
        loan.UpdatedAt = DateTime.UtcNow;
    }

    public static bool TryParseInterestMethod(string? value, out InterestMethod method)
    {
        method = InterestMethod.Flat;
        if (string.IsNullOrWhiteSpace(value)) return true;
        var normalized = value.Replace("-", "", StringComparison.Ordinal).Replace(" ", "", StringComparison.Ordinal);
        if (normalized.Equals("Declining", StringComparison.OrdinalIgnoreCase))
        {
            method = InterestMethod.DecliningBalance;
            return true;
        }
        return Enum.TryParse(normalized, ignoreCase: true, out method);
    }

    public void RebuildSchedule(Loan loan)
    {
        if (loan.ScheduleItems.Count > 0)
        {
            _db.LoanScheduleItems.RemoveRange(loan.ScheduleItems);
            loan.ScheduleItems.Clear();
        }

        if (loan.TermCount <= 0 || loan.Amount <= 0 || loan.FirstDueDate is null)
            return;

        var portions = ComputeSchedulePortions(
            loan.Amount, loan.InterestRatePercent, loan.TermCount, loan.InterestMethod);

        for (var i = 0; i < portions.Count; i++)
        {
            var portion = portions[i];
            loan.ScheduleItems.Add(new LoanScheduleItem
            {
                InstallmentNumber = i + 1,
                DueDate = AddPeriod(loan.FirstDueDate.Value, loan.PaymentFrequency, i),
                AmountDue = portion.AmountDue,
                PrincipalPortion = portion.Principal,
                InterestPortion = portion.Interest,
                PenaltyAmount = 0,
                PaidAmount = 0,
                Status = ScheduleItemStatus.Pending,
            });
        }
    }

    public static List<(decimal Principal, decimal Interest, decimal AmountDue)> ComputeSchedulePortions(
        decimal principal,
        decimal ratePercent,
        int termCount,
        InterestMethod method)
    {
        if (method == InterestMethod.DecliningBalance)
            return ComputeDecliningPortions(principal, ratePercent, termCount);

        var interestTotal = decimal.Round(principal * ratePercent / 100m, 2);
        var totalPayable = principal + interestTotal;
        var installment = decimal.Round(totalPayable / termCount, 2);
        var principalEach = decimal.Round(principal / termCount, 2);
        var interestEach = decimal.Round(interestTotal / termCount, 2);
        var allocatedPrincipal = 0m;
        var allocatedInterest = 0m;
        var allocatedTotal = 0m;
        var items = new List<(decimal Principal, decimal Interest, decimal AmountDue)>(termCount);

        for (var i = 1; i <= termCount; i++)
        {
            var isLast = i == termCount;
            var principalPortion = isLast ? principal - allocatedPrincipal : principalEach;
            var interestPortion = isLast ? interestTotal - allocatedInterest : interestEach;
            var amountDue = isLast ? totalPayable - allocatedTotal : installment;
            allocatedPrincipal += principalPortion;
            allocatedInterest += interestPortion;
            allocatedTotal += amountDue;
            items.Add((principalPortion, interestPortion, amountDue));
        }

        return items;
    }

    private static List<(decimal Principal, decimal Interest, decimal AmountDue)> ComputeDecliningPortions(
        decimal principal,
        decimal ratePercent,
        int termCount)
    {
        var r = ratePercent / 100m;
        decimal regularInstallment;
        if (r == 0m)
        {
            regularInstallment = decimal.Round(principal / termCount, 2, MidpointRounding.AwayFromZero);
        }
        else
        {
            var factor = Math.Pow((double)(1m + r), termCount);
            if (double.IsInfinity(factor) || double.IsNaN(factor) || factor <= 1)
                throw new InvalidOperationException("Declining-balance rate and term produce an invalid amortization factor.");
            regularInstallment = decimal.Round(
                principal * r * (decimal)factor / ((decimal)factor - 1m),
                2,
                MidpointRounding.AwayFromZero);
        }

        var remaining = principal;
        var items = new List<(decimal Principal, decimal Interest, decimal AmountDue)>(termCount);
        for (var i = 1; i <= termCount; i++)
        {
            var interest = decimal.Round(remaining * r, 2, MidpointRounding.AwayFromZero);
            decimal principalPortion;
            decimal amountDue;
            if (i == termCount)
            {
                principalPortion = remaining;
                amountDue = remaining + interest;
            }
            else
            {
                principalPortion = decimal.Round(regularInstallment - interest, 2, MidpointRounding.AwayFromZero);
                if (principalPortion < 0) principalPortion = 0;
                if (principalPortion > remaining) principalPortion = remaining;
                amountDue = principalPortion + interest;
            }

            remaining -= principalPortion;
            items.Add((principalPortion, interest, amountDue));
        }

        return items;
    }

    public async Task ApplyPaymentAsync(Loan loan, decimal amount)
    {
        if (amount <= 0) throw new InvalidOperationException("Payment amount must be greater than zero.");
        if (loan.Status == LoanStatus.Closed)
            throw new InvalidOperationException("This loan is already closed / matured.");
        if (loan.Status != LoanStatus.ApprovedFinal)
            throw new InvalidOperationException("Payments are only allowed on approved-final loans.");

        await AccruePenaltiesAsync(loan);

        var remaining = amount;
        var today = DateTime.UtcNow.Date;
        var items = loan.ScheduleItems.OrderBy(s => s.InstallmentNumber).ToList();

        foreach (var item in items)
        {
            if (remaining <= 0) break;
            var balance = ItemBalance(item);
            if (balance <= 0) continue;

            var apply = Math.Min(balance, remaining);
            item.PaidAmount += apply;
            remaining -= apply;
            RefreshStatus(item, today);
        }

        if (remaining > 0)
            throw new InvalidOperationException("Payment exceeds remaining loan balance.");
    }

    /// <summary>
    /// Marks an ApprovedFinal loan as Closed when schedule (incl. penalties) is fully settled.
    /// </summary>
    public bool TryMatureIfFullyPaid(Loan loan, ApplicationUser? actor = null)
    {
        if (loan.Status != LoanStatus.ApprovedFinal) return false;
        if (loan.TotalPayable <= 0 || loan.ScheduleItems.Count == 0) return false;

        var scheduleRemaining = loan.ScheduleItems.Sum(ItemBalance);
        if (scheduleRemaining > 0.009m) return false;

        loan.Status = LoanStatus.Closed;
        loan.UpdatedAt = DateTime.UtcNow;

        _db.LoanActivities.Add(new LoanActivity
        {
            LoanId = loan.Id,
            Type = LoanActivityType.Closed,
            StageId = loan.CurrentStageId,
            StageName = loan.CurrentStage?.Name ?? "Approved-Final",
            ActorUserId = actor?.Id,
            ActorName = actor?.FullName,
            Notes = "Loan matured — fully paid",
            OccurredAt = DateTime.UtcNow,
        });

        return true;
    }

    public async Task<int> MatureFullyPaidLoansAsync()
    {
        var loans = await _db.Loans
            .Include(l => l.CurrentStage)
            .Include(l => l.ScheduleItems)
            .Include(l => l.Payments)
            .Where(l => l.Status == LoanStatus.ApprovedFinal && l.TermCount > 0)
            .ToListAsync();

        var count = 0;
        foreach (var loan in loans)
        {
            await AccruePenaltiesAsync(loan);
            if (TryMatureIfFullyPaid(loan)) count++;
        }

        return count;
    }

    public async Task AccruePenaltiesAsync(Loan loan, DateTime? asOf = null)
    {
        var settings = await GetLateFeeSettingsAsync();
        var day = (asOf ?? DateTime.UtcNow).Date;
        foreach (var item in loan.ScheduleItems)
        {
            AccruePenaltyOnItem(item, settings, day);
            RefreshStatus(item, day);
        }
    }

    /// <summary>
    /// Accrues and persists late fees on all unpaid ApprovedFinal/Closed schedule items as of <paramref name="asOf"/>.
    /// Call before collection lists, dashboard KPIs, and aging/PAR reports so PenaltyAmount is stored.
    /// </summary>
    public async Task AccrueOpenItemsAsync(DateTime? asOf = null)
    {
        var settings = await GetLateFeeSettingsAsync();
        var day = (asOf ?? DateTime.UtcNow).Date;

        var items = await (
            from item in _db.LoanScheduleItems
            join loan in _db.Loans on item.LoanId equals loan.Id
            where (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
                  && item.PaidAmount < item.AmountDue + item.PenaltyAmount
            select item).ToListAsync();

        foreach (var item in items)
        {
            AccruePenaltyOnItem(item, settings, day);
            RefreshStatus(item, day);
        }

        if (_db.ChangeTracker.HasChanges())
            await _db.SaveChangesAsync();
    }

    public async Task RefreshAllStatusesAsync(Loan loan, DateTime? asOf = null)
    {
        await AccruePenaltiesAsync(loan, asOf);
    }

    public void RefreshAllStatuses(Loan loan, DateTime? asOf = null)
    {
        // Sync path used after load when settings already applied or disabled — still refresh status.
        var day = (asOf ?? DateTime.UtcNow).Date;
        var settings = _cachedLateFees;
        foreach (var item in loan.ScheduleItems)
        {
            if (settings is not null)
                AccruePenaltyOnItem(item, settings, day);
            RefreshStatus(item, day);
        }
    }

    public static void RefreshStatus(LoanScheduleItem item, DateTime asOfDate)
    {
        var totalDue = ItemTotalDue(item);
        if (item.PaidAmount >= totalDue && totalDue > 0)
        {
            item.Status = ScheduleItemStatus.Paid;
            item.PaidAmount = totalDue;
            return;
        }

        // Fully paid zero-due edge
        if (totalDue <= 0 && item.PaidAmount <= 0)
        {
            item.Status = ScheduleItemStatus.Paid;
            return;
        }

        if (item.PaidAmount > 0)
        {
            item.Status = ScheduleItemStatus.Partial;
            return;
        }

        item.Status = item.DueDate.Date < asOfDate
            ? ScheduleItemStatus.Overdue
            : ScheduleItemStatus.Pending;
    }

    public async Task<LateFeeSettings> GetLateFeeSettingsAsync()
    {
        if (_cachedLateFees is not null) return _cachedLateFees;

        var row = await _db.LateFeeSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1);
        _cachedLateFees = row ?? new LateFeeSettings { Id = 1, IsEnabled = false };
        return _cachedLateFees;
    }

    public void InvalidateLateFeeCache() => _cachedLateFees = null;

    public static decimal CalculatePenalty(LoanScheduleItem item, LateFeeSettings settings, DateTime asOfDate)
    {
        if (!settings.IsEnabled) return 0;

        var daysPastDue = (asOfDate.Date - item.DueDate.Date).Days;
        var chargeableDays = daysPastDue - Math.Max(0, settings.GraceDays);
        if (chargeableDays <= 0) return 0;

        decimal fee = settings.Type switch
        {
            LateFeeType.FlatOnce => settings.Amount,
            LateFeeType.FlatPerDay => settings.Amount * chargeableDays,
            LateFeeType.PercentOfInstallmentPerDay =>
                decimal.Round(item.AmountDue * (settings.Percent / 100m) * chargeableDays, 2, MidpointRounding.AwayFromZero),
            _ => 0
        };

        if (fee < 0) fee = 0;
        if (settings.MaxPerInstallment is decimal max && max > 0 && fee > max)
            fee = max;

        return decimal.Round(fee, 2, MidpointRounding.AwayFromZero);
    }

    private static void AccruePenaltyOnItem(LoanScheduleItem item, LateFeeSettings settings, DateTime asOfDate)
    {
        if (!settings.IsEnabled)
        {
            if (item.PaidAmount <= item.AmountDue)
                item.PenaltyAmount = 0;
            return;
        }

        // Freeze once this installment (base + penalty) is fully paid.
        if (item.PaidAmount >= item.AmountDue + item.PenaltyAmount && item.AmountDue + item.PenaltyAmount > 0
            && ItemBalance(item) <= 0)
            return;

        var computed = CalculatePenalty(item, settings, asOfDate);
        var paidTowardPenalty = Math.Max(0, item.PaidAmount - item.AmountDue);
        item.PenaltyAmount = Math.Max(computed, paidTowardPenalty);
    }

    public static DateTime AddPeriod(DateTime start, PaymentFrequency frequency, int periods) =>
        frequency switch
        {
            PaymentFrequency.Daily => start.AddDays(periods),
            PaymentFrequency.Weekly => start.AddDays(7 * periods),
            PaymentFrequency.BiWeekly => start.AddDays(14 * periods),
            _ => start.AddMonths(periods),
        };

    public async Task<Loan?> LoadLoanFinanceAsync(int loanId) =>
        await _db.Loans
            .Include(l => l.Customer)
            .Include(l => l.Flow)
            .Include(l => l.CurrentStage)
            .Include(l => l.CreatedByUser)
            .Include(l => l.ScheduleItems)
            .Include(l => l.Payments).ThenInclude(p => p.RecordedByUser)
            .Include(l => l.Approvals).ThenInclude(a => a.Stage)
            .Include(l => l.Approvals).ThenInclude(a => a.DecidedByUser)
            .Include(l => l.LoanProduct)
            .FirstOrDefaultAsync(l => l.Id == loanId);
}
