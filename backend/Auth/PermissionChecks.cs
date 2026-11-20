using System.Security.Claims;

namespace MicroLending.Api.Auth;

public static class PermissionChecks
{
    /// <summary>Loans, customers, approvals, or disbursement staff reviewing an application package.</summary>
    public static bool CanReviewLoanApplication(ClaimsPrincipal user) =>
        user.HasClaim("permission", PermissionCodes.LoansView)
        || user.HasClaim("permission", PermissionCodes.CustomersView)
        || user.HasClaim("permission", PermissionCodes.ApprovalsView)
        || user.HasClaim("permission", PermissionCodes.ApprovalsManage)
        || user.HasClaim("permission", PermissionCodes.PaymentScheduleView)
        || user.HasClaim("permission", PermissionCodes.PaymentScheduleManage);
}
