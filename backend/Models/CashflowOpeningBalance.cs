namespace MicroLending.Api.Models;

/// <summary>Beginning cash balance for cashflow as of a calendar date (per branch; null = all/HQ).</summary>
public class CashflowOpeningBalance
{
    public int Id { get; set; }
    public DateTime AsOfDate { get; set; }
    public int? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public decimal Amount { get; set; }
    public string UpdatedByUserId { get; set; } = string.Empty;
    public ApplicationUser UpdatedByUser { get; set; } = null!;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
