namespace MicroLending.Api.Models;

/// <summary>Manual cash injected into office float (cashflow +Injected funds).</summary>
public class CashflowFundInjection
{
    public int Id { get; set; }
    public DateTime InjectionDate { get; set; }
    public int? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public string RecordedByUserId { get; set; } = string.Empty;
    public ApplicationUser RecordedByUser { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
