using System.ComponentModel.DataAnnotations;

namespace MicroLending.Api.Dtos;

public class LoginRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public record LoginResponse(string Token, DateTime ExpiresAt, AuthUserResponse User);

public record AuthUserResponse(
    string Id,
    string Email,
    string FullName,
    string Role,
    bool IsAdmin,
    int? BranchId,
    string? BranchName,
    IReadOnlyList<string> Permissions,
    string? FirstName = null,
    string? MiddleName = null,
    string? LastName = null,
    DateTime? DateOfBirth = null,
    string? Mobile = null,
    string? Phone = null,
    string? HouseUnit = null,
    string? Street = null,
    string? Barangay = null,
    string? City = null,
    string? Province = null,
    string? ZipCode = null,
    string? AddressDisplay = null,
    bool HasProfilePicture = false);

public class UpdateProfileRequest
{
    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;
    [MaxLength(100)]
    public string? MiddleName { get; set; }
    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;
    public DateTime? DateOfBirth { get; set; }
    [MaxLength(50)]
    public string? Mobile { get; set; }
    [MaxLength(50)]
    public string? Phone { get; set; }
    [MaxLength(100)]
    public string? HouseUnit { get; set; }
    [MaxLength(200)]
    public string? Street { get; set; }
    [MaxLength(150)]
    public string? Barangay { get; set; }
    [MaxLength(150)]
    public string? City { get; set; }
    [MaxLength(150)]
    public string? Province { get; set; }
    [MaxLength(20)]
    public string? ZipCode { get; set; }
}

public class ChangePasswordRequest
{
    [Required, MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}

public record RoleDto(string Id, string Name, string? Description, bool IsSystem, IReadOnlyList<string> Permissions);

public class CreateRoleRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}

public class UpdateRoleRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}

public class SetRolePermissionsRequest
{
    public List<string> PermissionCodes { get; set; } = [];
}

public record PermissionDto(int Id, string Code, string Name, string Module);

public record AppPageDto(
    int Id,
    string Code,
    string Name,
    string Path,
    string GroupName,
    int SortOrder,
    string PermissionCode);

public record RolePageAccessDto(string RoleId, string RoleName, IReadOnlyList<string> PageCodes);

public class SetRolePagesRequest
{
    public List<string> PageCodes { get; set; } = [];
}

public record UserDto(
    string Id,
    string Email,
    string FullName,
    string? FirstName,
    string? MiddleName,
    string? LastName,
    DateTime? DateOfBirth,
    string? Mobile,
    string? Phone,
    string? HouseUnit,
    string? Street,
    string? Barangay,
    string? City,
    string? Province,
    string? ZipCode,
    string AddressDisplay,
    bool HasProfilePicture,
    string Role,
    int? BranchId,
    string? BranchName,
    bool IsActive,
    bool IsDeleted,
    DateTime? DeletedAt);

public class CreateUserRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;
    [MaxLength(100)]
    public string? MiddleName { get; set; }
    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;
    public DateTime? DateOfBirth { get; set; }
    [MaxLength(50)]
    public string? Mobile { get; set; }
    [MaxLength(50)]
    public string? Phone { get; set; }
    [MaxLength(100)]
    public string? HouseUnit { get; set; }
    [MaxLength(200)]
    public string? Street { get; set; }
    [MaxLength(150)]
    public string? Barangay { get; set; }
    [MaxLength(150)]
    public string? City { get; set; }
    [MaxLength(150)]
    public string? Province { get; set; }
    [MaxLength(20)]
    public string? ZipCode { get; set; }

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string RoleName { get; set; } = string.Empty;

    public int? BranchId { get; set; }
}

public class UpdateUserRequest
{
    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;
    [MaxLength(100)]
    public string? MiddleName { get; set; }
    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;
    public DateTime? DateOfBirth { get; set; }
    [MaxLength(50)]
    public string? Mobile { get; set; }
    [MaxLength(50)]
    public string? Phone { get; set; }
    [MaxLength(100)]
    public string? HouseUnit { get; set; }
    [MaxLength(200)]
    public string? Street { get; set; }
    [MaxLength(150)]
    public string? Barangay { get; set; }
    [MaxLength(150)]
    public string? City { get; set; }
    [MaxLength(150)]
    public string? Province { get; set; }
    [MaxLength(20)]
    public string? ZipCode { get; set; }

    [Required]
    public string RoleName { get; set; } = string.Empty;

    public int? BranchId { get; set; }
}

public class ResetUserPasswordRequest
{
    [Required, MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}

public class SetUserActiveRequest
{
    public bool IsActive { get; set; }
}
