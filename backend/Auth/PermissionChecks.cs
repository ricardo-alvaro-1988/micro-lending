using System.Security.Claims;

namespace MicroLending.Api.Auth;

public static class PermissionChecks
{
    /// <summary>Loans, customers, or approvals staff reviewing an application package.</summary>
    public static bool CanReviewLoanApplication(ClaimsPrincipal user) =>
        user.HasClaim("permission", PermissionCodes.LoansView)
        || user.HasClaim("permission", PermissionCodes.CustomersView)
        || user.HasClaim("permission", PermissionCodes.ApprovalsView)
        || user.HasClaim("permission", PermissionCodes.ApprovalsManage);
}
