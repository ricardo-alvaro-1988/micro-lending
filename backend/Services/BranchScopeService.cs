using System.Security.Claims;
using MicroLending.Api.Data;
using MicroLending.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Services;

public record BranchScope(
    bool IsAdmin,
    bool IsFieldAgent,
    string UserId,
    int? UserBranchId,
    string? UserBranchName,
    /// <summary>Null = all branches (admin only). Otherwise filter to this branch.</summary>
    int? EffectiveBranchId);

public class BranchScopeService
{
    public const string FieldAgentRoleName = "Field Agent";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _db;

    public BranchScopeService(UserManager<ApplicationUser> userManager, AppDbContext db)
    {
        _userManager = userManager;
        _db = db;
    }

    public async Task<BranchScope?> ResolveAsync(ClaimsPrincipal principal, int? requestedBranchId = null)
    {
        var user = await _userManager.GetUserAsync(principal);
        if (user is null)
        {
            var id = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
            if (string.IsNullOrWhiteSpace(id)) return null;
            user = await _userManager.Users.Include(u => u.Branch).FirstOrDefaultAsync(u => u.Id == id);
        }
        else if (user.Branch is null && user.BranchId is not null)
        {
            await _db.Entry(user).Reference(u => u.Branch).LoadAsync();
        }

        if (user is null || user.IsDeleted) return null;

        var roles = await _userManager.GetRolesAsync(user);
        var isAdmin = roles.Contains("Admin");
        var isFieldAgent = !isAdmin && roles.Contains(FieldAgentRoleName);
        var branchName = user.Branch?.Name;

        int? effective;
        if (isAdmin)
        {
            effective = requestedBranchId;
        }
        else
        {
            // Staff / field agents are locked to their own branch (ignore client filter).
            effective = user.BranchId;
        }

        return new BranchScope(isAdmin, isFieldAgent, user.Id, user.BranchId, branchName, effective);
    }

    public static IQueryable<Customer> Customers(IQueryable<Customer> query, BranchScope scope)
    {
        if (scope.IsFieldAgent)
        {
            query = query.Where(c => c.Agent1UserId == scope.UserId);
            if (scope.EffectiveBranchId is int agentBranch)
                query = query.Where(c => c.BranchId == agentBranch);
            return query;
        }

        if (scope.IsAdmin && scope.EffectiveBranchId is null) return query;
        if (scope.EffectiveBranchId is int branchId)
            return query.Where(c => c.BranchId == branchId);
        // Non-admin with no branch assigned sees nothing.
        return query.Where(_ => false);
    }

    public static IQueryable<Loan> Loans(IQueryable<Loan> query, BranchScope scope)
    {
        if (scope.IsFieldAgent)
        {
            query = query.Where(l => l.Customer.Agent1UserId == scope.UserId);
            if (scope.EffectiveBranchId is int agentBranch)
                query = query.Where(l => l.Customer.BranchId == agentBranch);
            return query;
        }

        if (scope.IsAdmin && scope.EffectiveBranchId is null) return query;
        if (scope.EffectiveBranchId is int branchId)
            return query.Where(l => l.Customer.BranchId == branchId);
        return query.Where(_ => false);
    }

    public static IQueryable<ApplicationUser> Users(IQueryable<ApplicationUser> query, BranchScope scope)
    {
        if (scope.IsAdmin && scope.EffectiveBranchId is null) return query;
        if (scope.EffectiveBranchId is int branchId)
            return query.Where(u => u.BranchId == branchId);
        return query.Where(_ => false);
    }

    public static IQueryable<Branch> Branches(IQueryable<Branch> query, BranchScope scope)
    {
        if (scope.IsAdmin && scope.EffectiveBranchId is null) return query;
        if (scope.EffectiveBranchId is int branchId)
            return query.Where(b => b.Id == branchId);
        return query.Where(_ => false);
    }

    public static bool CanAccessBranch(BranchScope scope, int? entityBranchId)
    {
        if (scope.IsAdmin) return true;
        if (scope.UserBranchId is null) return false;
        return entityBranchId == scope.UserBranchId;
    }

    /// <summary>Branch + Agent-1 assignment check for field agents.</summary>
    public static bool CanAccessCustomer(BranchScope scope, Customer customer) =>
        CanAccessCustomer(scope, customer.BranchId, customer.Agent1UserId);

    public static bool CanAccessCustomer(BranchScope scope, int? branchId, string? agent1UserId)
    {
        if (!CanAccessBranch(scope, branchId)) return false;
        if (scope.IsFieldAgent) return agent1UserId == scope.UserId;
        return true;
    }

    /// <summary>Branch id that must be written on create/update for non-admins.</summary>
    public static int? EnforceWriteBranchId(BranchScope scope, int? requestedBranchId)
    {
        if (scope.IsAdmin) return requestedBranchId;
        return scope.UserBranchId;
    }
}
