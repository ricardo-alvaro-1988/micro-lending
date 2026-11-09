using Microsoft.AspNetCore.Identity;

namespace MicroLending.Api.Models;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? LastName { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Mobile { get; set; }
    public string? Phone { get; set; }
    public string? HouseUnit { get; set; }
    public string? Street { get; set; }
    public string? Barangay { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? ZipCode { get; set; }
    public string? ProfilePictureStoredFileName { get; set; }
    public string? ProfilePictureContentType { get; set; }
    public int? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    public void RefreshFullName()
    {
        var composed = string.Join(" ", new[] { FirstName, MiddleName, LastName }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim()));
        if (!string.IsNullOrWhiteSpace(composed))
            FullName = composed;
    }

    public string FormatAddress() =>
        string.Join(", ", new[] { HouseUnit, Street, Barangay, City, Province, ZipCode }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim()));
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
