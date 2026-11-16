using MicroLending.Api.Models;

namespace MicroLending.Api.Services;

/// <summary>
/// Disposition fees + savings/insurance inputs matching the printed loan proceeds sheet.
/// Net proceeds = principal − (membership + processing + redemption + taxes + notarial + raffle).
/// Header insurance / initial savings are shown separately and are not part of that deduction total.
/// </summary>
public record LoanChargeInputs(
    decimal InsuranceAmount = 0,
    decimal InitialSavings = 0,
    decimal SavingsPerPeriod = 0,
    decimal InsurancePerPeriod = 0,
    decimal MembershipFee = 0,
    decimal ProcessingFee = 0,
    decimal LoanRedemptionFee = 0,
    decimal Taxes = 0,
    decimal NotarialFee = 0,
    decimal Raffle = 0)
{
    public bool IsEmpty =>
        InsuranceAmount == 0
        && InitialSavings == 0
        && SavingsPerPeriod == 0
        && InsurancePerPeriod == 0
        && MembershipFee == 0
        && ProcessingFee == 0
        && LoanRedemptionFee == 0
        && Taxes == 0
        && NotarialFee == 0
        && Raffle == 0;

    public static LoanChargeInputs FromLoan(Loan loan) => new(
        loan.InsuranceAmount,
        loan.InitialSavings,
        loan.SavingsPerPeriod,
        loan.InsurancePerPeriod,
        loan.MembershipFee,
        loan.ProcessingFee,
        loan.LoanRedemptionFee,
        loan.Taxes,
        loan.NotarialFee,
        loan.Raffle);

    public static LoanChargeInputs FromProduct(LoanProduct product) => new(
        product.InsuranceAmount,
        product.InitialSavings,
        product.SavingsPerPeriod,
        product.InsurancePerPeriod,
        product.MembershipFee,
        product.ProcessingFee,
        product.LoanRedemptionFee,
        product.Taxes,
        product.NotarialFee,
        product.Raffle);
}
