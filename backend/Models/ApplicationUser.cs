using Microsoft.AspNetCore.Identity;

namespace MicroLending.Api.Models;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

public class ApplicationRole : IdentityRole
{
    public bool IsSystem { get; set; }
    public string? Description { get; set; }
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public class Permission
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    public ICollection<AppPage> Pages { get; set; } = new List<AppPage>();
}

public class RolePermission
{
    public string RoleId { get; set; } = string.Empty;
    public ApplicationRole Role { get; set; } = null!;
    public int PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;
}

/// <summary>Navigable app page used by Page Accessibility.</summary>
public class AppPage
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;
}
