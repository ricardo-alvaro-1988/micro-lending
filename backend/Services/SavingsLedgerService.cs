using MicroLending.Api.Data;
using MicroLending.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Services;

public class SavingsLedgerService
{
    private readonly AppDbContext _db;

    public SavingsLedgerService(AppDbContext db) => _db = db;

    public async Task EnsurePrimaryFromInitialAsync(Loan loan, string? recordedByUserId = null)
    {
        if (loan.InitialSavings <= 0) return;

        var already = await _db.SavingsTransactions.AnyAsync(t =>
            t.LoanId == loan.Id
            && t.Kind == SavingsKind.Primary
            && t.Type == SavingsTransactionType.InitialSavings);
        if (already) return;

        Post(
            loan,
            SavingsKind.Primary,
            SavingsTransactionType.InitialSavings,
            loan.InitialSavings,
            recordedByUserId,
            notes: "Initial savings (primary)");
    }

    public decimal Post(
        Loan loan,
        SavingsKind kind,
        SavingsTransactionType type,
        decimal signedAmount,
        string? recordedByUserId = null,
        LoanPayment? loanPayment = null,
        int? scheduleItemId = null,
        string? notes = null,
        DateTime? occurredAt = null)
    {
        var amount = decimal.Round(signedAmount, 2, MidpointRounding.AwayFromZero);
        if (amount == 0) return kind == SavingsKind.Primary ? loan.PrimarySavingsBalance : loan.ExtraSavingsBalance;

        // Primary (= initial savings) is ring-fenced: credits only, never deductions/offsets.
        if (kind == SavingsKind.Primary && amount < 0)
            throw new InvalidOperationException("Primary savings cannot be deducted. Use extra savings for underpayment offsets.");
        if (kind == SavingsKind.Primary
            && type is not (SavingsTransactionType.InitialSavings or SavingsTransactionType.ManualAdjust))
            throw new InvalidOperationException("Primary savings only accepts initial savings (or manual credit adjustments).");
        if (kind == SavingsKind.Primary && type == SavingsTransactionType.ManualAdjust && amount < 0)
            throw new InvalidOperationException("Primary savings cannot be reduced.");

        // Underpay offsets must always post to Extra, never Primary.
        if (type == SavingsTransactionType.UnderpayOffset && kind != SavingsKind.Extra)
            throw new InvalidOperationException("Underpayment offsets can only deduct from extra savings.");

        var balance = kind == SavingsKind.Primary ? loan.PrimarySavingsBalance : loan.ExtraSavingsBalance;
        var next = decimal.Round(balance + amount, 2, MidpointRounding.AwayFromZero);
        if (next < 0)
            throw new InvalidOperationException("Insufficient extra savings balance.");

        if (kind == SavingsKind.Primary)
            loan.PrimarySavingsBalance = next;
        else
            loan.ExtraSavingsBalance = next;

        _db.SavingsTransactions.Add(new SavingsTransaction
        {
            CustomerId = loan.CustomerId,
            LoanId = loan.Id,
            Kind = kind,
            Type = type,
            Amount = amount,
            BalanceAfter = next,
            OccurredAt = occurredAt ?? DateTime.UtcNow,
            LoanPayment = loanPayment,
            ScheduleItemId = scheduleItemId,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            RecordedByUserId = recordedByUserId,
            CreatedAt = DateTime.UtcNow,
        });

        return next;
    }

    /// <summary>Debit extra savings up to shortfall; returns amount deducted.</summary>
    public decimal OffsetUnderpayFromExtra(
        Loan loan,
        decimal shortfall,
        string? recordedByUserId,
        LoanPayment? loanPayment = null,
        int? scheduleItemId = null)
    {
        if (shortfall <= 0 || loan.ExtraSavingsBalance <= 0) return 0;
        var take = Math.Min(loan.ExtraSavingsBalance, decimal.Round(shortfall, 2, MidpointRounding.AwayFromZero));
        if (take <= 0) return 0;
        Post(
            loan,
            SavingsKind.Extra,
            SavingsTransactionType.UnderpayOffset,
            -take,
            recordedByUserId,
            loanPayment,
            scheduleItemId,
            notes: "Underpayment offset from extra savings");
        return take;
    }

    public void CreditDailySavingsForNewlyPaid(
        Loan loan,
        IEnumerable<int> newlyPaidScheduleItemIds,
        string? recordedByUserId,
        LoanPayment? loanPayment = null)
    {
        var ids = newlyPaidScheduleItemIds.ToHashSet();
        if (ids.Count == 0) return;

        foreach (var item in loan.ScheduleItems.Where(s => ids.Contains(s.Id)))
        {
            if (item.SavingsPortion <= 0) continue;
            Post(
                loan,
                SavingsKind.Extra,
                SavingsTransactionType.DailySavings,
                item.SavingsPortion,
                recordedByUserId,
                loanPayment,
                item.Id,
                notes: $"Daily savings · installment #{item.InstallmentNumber}");
        }
    }
}
