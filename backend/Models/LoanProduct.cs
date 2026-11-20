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
    public decimal InterestRatePercent { get; set; } = 12.5m;
    public int TermCount { get; set; } = 70;
    public PaymentFrequency PaymentFrequency { get; set; } = PaymentFrequency.Daily;
    public InterestMethod InterestMethod { get; set; } = InterestMethod.Flat;

    /// <summary>Header insurance amount (policy / declared total).</summary>
    public decimal InsuranceAmount { get; set; }
    /// <summary>Initial savings held at release.</summary>
    public decimal InitialSavings { get; set; }
    /// <summary>Savings collected each installment.</summary>
    public decimal SavingsPerPeriod { get; set; }
    /// <summary>Insurance collected each installment.</summary>
    public decimal InsurancePerPeriod { get; set; }
    public decimal MembershipFee { get; set; }
    public decimal ProcessingFee { get; set; }
    public decimal LoanRedemptionFee { get; set; }
    public decimal Taxes { get; set; }
    public decimal NotarialFee { get; set; }
    public decimal Raffle { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Loan> Loans { get; set; } = new List<Loan>();
}
