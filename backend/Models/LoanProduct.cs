namespace MicroLending.Api.Models;

public enum InterestMethod
{
    Flat = 0,
    DecliningBalance = 1
}

/// <summary>Reusable loan template (amount, rate, term, frequency, interest method).</summary>
public class LoanProduct
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Amount { get; set; }
    public decimal InterestRatePercent { get; set; }
    public int TermCount { get; set; } = 12;
    public PaymentFrequency PaymentFrequency { get; set; } = PaymentFrequency.Monthly;
    public InterestMethod InterestMethod { get; set; } = InterestMethod.Flat;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Loan> Loans { get; set; } = new List<Loan>();
}
