namespace MicroLending.Api.Models;

/// <summary>Office / branch expense (salary, electric bill, etc.) for cashflow.</summary>
public class ExpenseEntry
{
    public int Id { get; set; }
    /// <summary>e.g. Salary, Electric bill.</summary>
    public string Label { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    /// <summary>Calendar date the expense applies to.</summary>
    public DateTime ExpenseDate { get; set; }
    public int? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public string? Notes { get; set; }
    public string RecordedByUserId { get; set; } = string.Empty;
    public ApplicationUser RecordedByUser { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
