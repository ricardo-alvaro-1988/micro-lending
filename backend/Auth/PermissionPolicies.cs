using Microsoft.AspNetCore.Authorization;

namespace MicroLending.Api.Auth;

public static class PermissionCodes
{
    public const string DashboardView = "dashboard.view";
    public const string RolesView = "roles.view";
    public const string RolesManage = "roles.manage";
    public const string PagesView = "pages.view";
    public const string PagesManage = "pages.manage";
    public const string UsersView = "users.view";
    public const string UsersManage = "users.manage";
    public const string ProfileView = "profile.view";
    public const string FlowsView = "flows.view";
    public const string FlowsManage = "flows.manage";
    public const string LoansView = "loans.view";
    public const string LoansManage = "loans.manage";
    public const string ApprovalsView = "approvals.view";
    public const string ApprovalsManage = "approvals.manage";
    public const string CustomersView = "customers.view";
    public const string CustomersManage = "customers.manage";
    public const string GroupsView = "groups.view";
    public const string GroupsManage = "groups.manage";
    public const string BranchesView = "branches.view";
    public const string BranchesManage = "branches.manage";
    public const string ActivityView = "activity.view";
    public const string PaymentScheduleView = "paymentSchedule.view";
    public const string PaymentScheduleManage = "paymentSchedule.manage";
    public const string PaymentScheduleSettings = "paymentSchedule.settings";
    public const string FieldCollect = "field.collect";
    public const string FieldNotes = "field.notes";
    public const string ReportsView = "reports.view";
    public const string LateFeesSettings = "lateFees.settings";
    public const string AuditView = "audit.view";
    public const string RemittanceView = "remittance.view";
    public const string RemittanceManage = "remittance.manage";
    public const string RemittanceReceive = "remittance.receive";
    public const string LoanProductsView = "loanProducts.view";
    public const string LoanProductsManage = "loanProducts.manage";

    public static IReadOnlyList<string> All { get; } =
    [
        DashboardView, RolesView, RolesManage, PagesView, PagesManage,
        UsersView, UsersManage, ProfileView,
        FlowsView, FlowsManage, LoansView, LoansManage, ApprovalsView, ApprovalsManage,
        CustomersView, CustomersManage, GroupsView, GroupsManage, BranchesView, BranchesManage,
        ActivityView, PaymentScheduleView, PaymentScheduleManage, PaymentScheduleSettings,
        FieldCollect, FieldNotes, ReportsView, LateFeesSettings,
        AuditView, RemittanceView, RemittanceManage, RemittanceReceive,
        LoanProductsView, LoanProductsManage
    ];
}

public class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }
    public PermissionRequirement(string permission) => Permission = permission;
}

public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var has = context.User.Claims.Any(c =>
            c.Type == "permission" && c.Value == requirement.Permission);

        if (has)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

public static class AuthorizationExtensions
{
    public static void AddPermissionPolicies(this AuthorizationOptions options)
    {
        foreach (var code in PermissionCodes.All)
        {
            options.AddPolicy($"perm:{code}", policy =>
                policy.Requirements.Add(new PermissionRequirement(code)));
        }
    }
}
