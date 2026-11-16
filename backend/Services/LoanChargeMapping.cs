using MicroLending.Api.Dtos;
using MicroLending.Api.Models;

namespace MicroLending.Api.Services;

public static class LoanChargeMapping
{
    public static LoanChargeInputs FromRequest(LoanChargeRequest request) => new(
        request.InsuranceAmount,
        request.InitialSavings,
        request.SavingsPerPeriod,
        request.InsurancePerPeriod,
        request.MembershipFee,
        request.ProcessingFee,
        request.LoanRedemptionFee,
        request.Taxes,
        request.NotarialFee,
        request.Raffle);

    public static LoanChargeInputs Resolve(LoanChargeRequest request, LoanProduct? product)
    {
        var fromRequest = FromRequest(request);
        if (!fromRequest.IsEmpty || product is null)
            return fromRequest;
        return LoanChargeInputs.FromProduct(product);
    }

    public static object ToAnonymous(Loan loan) => new
    {
        loan.InsuranceAmount,
        loan.InitialSavings,
        loan.SavingsPerPeriod,
        loan.InsurancePerPeriod,
        loan.MembershipFee,
        loan.ProcessingFee,
        loan.LoanRedemptionFee,
        loan.Taxes,
        loan.NotarialFee,
        loan.Raffle,
        loan.TotalDeductions,
        loan.NetProceeds,
    };
}
