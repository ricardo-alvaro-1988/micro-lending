namespace MicroLending.Api.Models;

public enum SavingsKind
{
    Primary = 0,
    Extra = 1
}

public enum SavingsTransactionType
{
    InitialSavings = 0,
    DailySavings = 1,
    ExtraDeposit = 2,
    UnderpayOffset = 3,
    ManualAdjust = 4
}

/// <summary>Append-only primary/extra savings ledger entry for a loan.</summary>
public class SavingsTransaction
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public SavingsKind Kind { get; set; }
    public SavingsTransactionType Type { get; set; }
    /// <summary>Signed amount: credit +, debit −.</summary>
    public decimal Amount { get; set; }
    public decimal BalanceAfter { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public int? LoanPaymentId { get; set; }
    public LoanPayment? LoanPayment { get; set; }
    public int? ScheduleItemId { get; set; }
    public LoanScheduleItem? ScheduleItem { get; set; }
    public string? Notes { get; set; }
    public string? RecordedByUserId { get; set; }
    public ApplicationUser? RecordedByUser { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
