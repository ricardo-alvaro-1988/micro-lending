using MicroLending.Api.Models;

namespace MicroLending.Api.Services;

/// <summary>
/// Loan product fee formulas (update-nov-19-2026):
/// notarial 5k=100 +5/1k; loan redemption 5k=70 +15/1k; processing 5k=100 +10/1k;
/// savings = principal×10%/terms; initial savings 2%; insurance brackets;
/// tax 1%; membership 125 on cycle 1 only (0 when cycle &gt; 1);
/// interest 12.5% with principal/interest rounded to tens;
/// daily principal / interest / savings / insurance rounded to whole pesos.
/// </summary>
public static class LoanFeeRules
{
    public const decimal DefaultInterestRatePercent = 12.5m;
    public const decimal MembershipFeeAmount = 125m;
    public const decimal DefaultInsurancePerPeriod = 5m;

    /// <summary>Membership is charged only on the first loan cycle.</summary>
    public static decimal MembershipFeeFor(int? cycle) =>
        cycle is null or <= 1 ? MembershipFeeAmount : 0m;

    public static decimal RoundToTens(decimal value) =>
        Math.Round(value / 10m, MidpointRounding.AwayFromZero) * 10m;

    /// <summary>Whole-peso rounding for daily payment lines (214.29→214, 25.71→26).</summary>
    public static decimal RoundToPeso(decimal value) =>
        Math.Round(value, 0, MidpointRounding.AwayFromZero);

    public static decimal SteppedFrom5k(decimal principal, decimal baseAt5k, decimal per1k)
    {
        if (principal <= 0) return 0;
        var steps = Math.Floor((principal - 5000m) / 1000m);
        var fee = baseAt5k + steps * per1k;
        return fee < 0 ? 0 : decimal.Round(fee, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Insurance brackets: 5k–10k = 200, then +50 every next 5k
    /// (11k–15k = 250, 16k–20k = 300, 21k–25k = 350, …).
    /// </summary>
    public static decimal InsuranceForPrincipal(decimal principal)
    {
        if (principal < 5000m) return 0;
        if (principal <= 10000m) return 200m;
        var bandsAbove10k = (int)Math.Ceiling((principal - 10000m) / 5000m);
        return 200m + bandsAbove10k * 50m;
    }

    public static decimal ProcessingFeeFor(decimal principal) =>
        SteppedFrom5k(principal, 100m, 10m);

    public static decimal LoanRedemptionFeeFor(decimal principal) =>
        SteppedFrom5k(principal, 70m, 15m);

    public static decimal NotarialFeeFor(decimal principal) =>
        SteppedFrom5k(principal, 100m, 5m);

    public static LoanChargeInputs ComputeCharges(decimal principalInput, int termCount, int? cycle = 1)
    {
        var principal = RoundToTens(principalInput);
        var terms = Math.Max(0, termCount);
        var savingsPerPeriod = terms > 0
            ? RoundToPeso(principal * 0.10m / terms)
            : 0m;

        return new LoanChargeInputs(
            InsuranceAmount: InsuranceForPrincipal(principal),
            InitialSavings: decimal.Round(principal * 0.02m, 2, MidpointRounding.AwayFromZero),
            SavingsPerPeriod: savingsPerPeriod,
            InsurancePerPeriod: DefaultInsurancePerPeriod,
            MembershipFee: MembershipFeeFor(cycle),
            ProcessingFee: ProcessingFeeFor(principal),
            LoanRedemptionFee: LoanRedemptionFeeFor(principal),
            Taxes: decimal.Round(principal * 0.01m, 2, MidpointRounding.AwayFromZero),
            NotarialFee: NotarialFeeFor(principal),
            Raffle: 0);
    }

    public static void ApplyComputedFees(
        LoanProduct product,
        decimal? principalInput = null,
        int? termCount = null)
    {
        var principal = RoundToTens(principalInput ?? product.Amount);
        var terms = termCount ?? product.TermCount;
        // Products are templates for a first-cycle loan (membership 125).
        var charges = ComputeCharges(principal, terms, cycle: 1);

        product.Amount = principal;
        product.InterestRatePercent = DefaultInterestRatePercent;
        product.TermCount = Math.Max(1, terms);
        product.InsuranceAmount = charges.InsuranceAmount;
        product.InitialSavings = charges.InitialSavings;
        product.SavingsPerPeriod = charges.SavingsPerPeriod;
        product.InsurancePerPeriod = charges.InsurancePerPeriod;
        product.MembershipFee = charges.MembershipFee;
        product.ProcessingFee = charges.ProcessingFee;
        product.LoanRedemptionFee = charges.LoanRedemptionFee;
        product.Taxes = charges.Taxes;
        product.NotarialFee = charges.NotarialFee;
        product.Raffle = charges.Raffle;
    }
}
