using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
using MicroLending.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly AppDbContext _db;
    private readonly BranchScopeService _branchScope;
    private readonly AuditService _audit;
    private readonly CustomerDocumentStorage _storage;

    public UsersController(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        AppDbContext db,
        BranchScopeService branchScope,
        AuditService audit,
        CustomerDocumentStorage storage)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _db = db;
        _branchScope = branchScope;
        _audit = audit;
        _storage = storage;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersView}")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAll(
        [FromQuery] bool includeDeleted = true,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var query = BranchScopeService.Users(_userManager.Users.Include(u => u.Branch).AsQueryable(), scope);
        if (!includeDeleted) query = query.Where(u => !u.IsDeleted);

        var users = await query.OrderBy(u => u.FullName).ToListAsync();
        var result = new List<UserDto>();
        foreach (var u in users)
        {
            result.Add(await MapAsync(u));
        }
        return Ok(result);
    }

    private bool CanAccessUserOptions() =>
        User.HasClaim("permission", PermissionCodes.UsersView)
        || User.HasClaim("permission", PermissionCodes.CustomersView)
        || User.HasClaim("permission", PermissionCodes.PaymentScheduleSettings)
        || User.HasClaim("permission", PermissionCodes.RemittanceView)
        || User.HasClaim("permission", PermissionCodes.RemittanceManage);

    /// <summary>Active, non-deleted users for customer field-agent dropdowns.</summary>
    [HttpGet("options")]
    public async Task<ActionResult<IEnumerable<AgentOptionDto>>> Options([FromQuery] int? branchId = null)
    {
        if (!CanAccessUserOptions()) return Forbid();

        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var now = DateTimeOffset.UtcNow;
        var query = BranchScopeService.Users(
            _userManager.Users
                .Where(u => !u.IsDeleted)
                .Where(u => !u.LockoutEnabled || u.LockoutEnd == null || u.LockoutEnd <= now),
            scope);

        var list = await query
            .OrderBy(u => u.FullName)
            .Select(u => new AgentOptionDto(
                u.Id,
                u.FullName,
                u.Email ?? string.Empty,
                u.ProfilePictureStoredFileName != null))
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request)
    {
        if (!await _roleManager.RoleExistsAsync(request.RoleName))
            return BadRequest(new { message = "Role does not exist." });

        if (await _userManager.FindByEmailAsync(request.Email) is not null)
            return Conflict(new { message = "Email already registered." });

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();
        if (!scope.IsAdmin)
            request.BranchId = BranchScopeService.EnforceWriteBranchId(scope, request.BranchId);

        var branchError = await ValidateBranchAsync(request.BranchId);
        if (branchError is not null) return BadRequest(new { message = branchError });

        var user = new ApplicationUser
        {
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            BranchId = request.BranchId,
            EmailConfirmed = true,
            LockoutEnabled = true,
        };
        ApplyProfile(user, request);

        var create = await _userManager.CreateAsync(user, request.Password);
        if (!create.Succeeded)
            return BadRequest(new { message = string.Join("; ", create.Errors.Select(e => e.Description)) });

        await _userManager.AddToRoleAsync(user, request.RoleName);
        await _db.Entry(user).Reference(u => u.Branch).LoadAsync();
        await _audit.LogAsync(
            "Created",
            "User",
            user.Id,
            $"Created user '{user.FullName}' ({user.Email}) as {request.RoleName}",
            new { user.Email, user.FullName, request.RoleName, user.BranchId });
        return CreatedAtAction(nameof(GetAll), await MapAsync(user));
    }

    [HttpPut("{id}")]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    public async Task<ActionResult<UserDto>> Update(string id, [FromBody] UpdateUserRequest request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var user = await _userManager.Users.Include(u => u.Branch).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null || user.IsDeleted) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, user.BranchId)) return NotFound();

        if (!await _roleManager.RoleExistsAsync(request.RoleName))
            return BadRequest(new { message = "Role does not exist." });

        if (!scope.IsAdmin)
            request.BranchId = BranchScopeService.EnforceWriteBranchId(scope, request.BranchId);

        var branchError = await ValidateBranchAsync(request.BranchId, user.BranchId);
        if (branchError is not null) return BadRequest(new { message = branchError });

        var currentRoles = await _userManager.GetRolesAsync(user);
        var wasAdmin = currentRoles.Contains("Admin");
        if (wasAdmin && request.RoleName != "Admin")
        {
            var adminUsers = await _userManager.GetUsersInRoleAsync("Admin");
            if (adminUsers.Count(u => !u.IsDeleted) <= 1)
                return BadRequest(new { message = "Cannot remove the last Admin user." });
        }

        ApplyProfile(user, request);
        user.BranchId = request.BranchId;
        await _userManager.UpdateAsync(user);
        await _db.Entry(user).Reference(u => u.Branch).LoadAsync();

        if (currentRoles.Any())
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, request.RoleName);

        await _audit.LogAsync(
            "Updated",
            "User",
            user.Id,
            $"Updated user '{user.FullName}' (role {request.RoleName})",
            new { user.FullName, request.RoleName, user.BranchId, PreviousRoles = currentRoles });

        return Ok(await MapAsync(user));
    }

    [HttpPost("{id}/reset-password")]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    public async Task<IActionResult> ResetPassword(string id, [FromBody] ResetUserPasswordRequest request)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null || user.IsDeleted) return NotFound();

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var reset = await _userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!reset.Succeeded)
            return BadRequest(new { message = string.Join("; ", reset.Errors.Select(e => e.Description)) });

        await _audit.LogAsync(
            "Updated",
            "User",
            user.Id,
            $"Reset password for user '{user.FullName}' ({user.Email})");

        return Ok(new { message = "Password reset successfully." });
    }

    [HttpPost("{id}/set-active")]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    public async Task<ActionResult<UserDto>> SetActive(string id, [FromBody] SetUserActiveRequest request)
    {
        var currentId = _userManager.GetUserId(User);
        if (id == currentId && !request.IsActive)
            return BadRequest(new { message = "You cannot deactivate your own account." });

        var user = await _userManager.Users.Include(u => u.Branch).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null || user.IsDeleted) return NotFound();

        if (!request.IsActive && await _userManager.IsInRoleAsync(user, "Admin"))
        {
            var admins = await _userManager.GetUsersInRoleAsync("Admin");
            var activeAdmins = admins.Count(u => !u.IsDeleted && IsActive(u));
            if (activeAdmins <= 1)
                return BadRequest(new { message = "Cannot deactivate the last active Admin." });
        }

        await _userManager.SetLockoutEnabledAsync(user, true);
        if (!request.IsActive)
            await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddYears(100));
        else
            await _userManager.SetLockoutEndDateAsync(user, null);

        await _audit.LogAsync(
            "Updated",
            "User",
            user.Id,
            request.IsActive
                ? $"Activated user '{user.FullName}'"
                : $"Deactivated user '{user.FullName}'",
            new { user.FullName, request.IsActive });

        return Ok(await MapAsync(user));
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    public async Task<IActionResult> SoftDelete(string id)
    {
        var currentId = _userManager.GetUserId(User);
        if (id == currentId) return BadRequest(new { message = "You cannot delete your own account." });

        var user = await _userManager.FindByIdAsync(id);
        if (user is null || user.IsDeleted) return NotFound();

        if (await _userManager.IsInRoleAsync(user, "Admin"))
        {
            var admins = await _userManager.GetUsersInRoleAsync("Admin");
            if (admins.Count(u => !u.IsDeleted) <= 1)
                return BadRequest(new { message = "Cannot delete the last Admin user." });
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        await _userManager.SetLockoutEnabledAsync(user, true);
        await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddYears(100));
        await _userManager.UpdateAsync(user);
        await _audit.LogAsync("Deleted", "User", user.Id, $"Soft-deleted user '{user.FullName}' ({user.Email})");
        return NoContent();
    }

    [HttpPost("{id}/restore")]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    public async Task<ActionResult<UserDto>> Restore(string id)
    {
        var user = await _userManager.Users.Include(u => u.Branch).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();
        if (!user.IsDeleted) return BadRequest(new { message = "User is not deleted." });

        user.IsDeleted = false;
        user.DeletedAt = null;
        await _userManager.SetLockoutEndDateAsync(user, null);
        await _userManager.UpdateAsync(user);
        await _audit.LogAsync("Updated", "User", user.Id, $"Restored user '{user.FullName}' ({user.Email})");
        return Ok(await MapAsync(user));
    }

    [HttpPost("{id}/profile-picture")]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    [RequestSizeLimit(6_000_000)]
    public async Task<ActionResult<object>> UploadProfilePicture(string id, [FromForm] IFormFile? file)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var user = await _userManager.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);
        if (user is null) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, user.BranchId)) return NotFound();
        if (file is null || file.Length <= 0) return BadRequest(new { message = "Image file is required." });

        try
        {
            if (!string.IsNullOrWhiteSpace(user.ProfilePictureStoredFileName))
                _storage.DeleteUserFileIfExists(user.Id, user.ProfilePictureStoredFileName);

            var saved = await _storage.SaveUserProfilePictureAsync(user.Id, file);
            user.ProfilePictureStoredFileName = saved.StoredFileName;
            user.ProfilePictureContentType = saved.ContentType;
            await _userManager.UpdateAsync(user);
            return Ok(new { hasProfilePicture = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (IOException ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = $"Could not store file: {ex.Message}" });
        }
    }

    [HttpGet("{id}/profile-picture")]
    public async Task<IActionResult> GetProfilePicture(string id)
    {
        // Same audience as /api/users/options (remittance / customers pickers need avatars).
        if (!CanAccessUserOptions()) return Forbid();

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var user = await _userManager.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, user.BranchId)) return NotFound();
        if (string.IsNullOrWhiteSpace(user.ProfilePictureStoredFileName)) return NotFound();

        var path = _storage.GetUserPhysicalPath(user.Id, user.ProfilePictureStoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound(new { message = "Profile picture missing on disk." });
        return PhysicalFile(path, user.ProfilePictureContentType ?? "image/jpeg");
    }

    [HttpDelete("{id}/profile-picture")]
    [Authorize(Policy = $"perm:{PermissionCodes.UsersManage}")]
    public async Task<IActionResult> DeleteProfilePicture(string id)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var user = await _userManager.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);
        if (user is null) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, user.BranchId)) return NotFound();
        if (string.IsNullOrWhiteSpace(user.ProfilePictureStoredFileName)) return NoContent();

        _storage.DeleteUserFileIfExists(user.Id, user.ProfilePictureStoredFileName);
        user.ProfilePictureStoredFileName = null;
        user.ProfilePictureContentType = null;
        await _userManager.UpdateAsync(user);
        return NoContent();
    }

    private async Task<string?> ValidateBranchAsync(int? branchId, int? currentBranchId = null)
    {
        if (branchId is null) return null;
        var branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId.Value);
        if (branch is null) return "Selected branch was not found.";
        if (!branch.IsActive && branchId != currentBranchId) return "Selected branch is inactive.";
        return null;
    }

    private static void ApplyProfile(ApplicationUser user, CreateUserRequest request) =>
        ApplyProfileFields(
            user,
            request.FirstName,
            request.MiddleName,
            request.LastName,
            request.DateOfBirth,
            request.Mobile,
            request.Phone,
            request.HouseUnit,
            request.Street,
            request.Barangay,
            request.City,
            request.Province,
            request.ZipCode);

    private static void ApplyProfile(ApplicationUser user, UpdateUserRequest request) =>
        ApplyProfileFields(
            user,
            request.FirstName,
            request.MiddleName,
            request.LastName,
            request.DateOfBirth,
            request.Mobile,
            request.Phone,
            request.HouseUnit,
            request.Street,
            request.Barangay,
            request.City,
            request.Province,
            request.ZipCode);

    private static void ApplyProfileFields(
        ApplicationUser user,
        string firstName,
        string? middleName,
        string lastName,
        DateTime? dateOfBirth,
        string? mobile,
        string? phone,
        string? houseUnit,
        string? street,
        string? barangay,
        string? city,
        string? province,
        string? zipCode)
    {
        user.FirstName = firstName.Trim();
        user.MiddleName = string.IsNullOrWhiteSpace(middleName) ? null : middleName.Trim();
        user.LastName = lastName.Trim();
        user.DateOfBirth = dateOfBirth;
        user.Mobile = string.IsNullOrWhiteSpace(mobile) ? null : mobile.Trim();
        user.Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        user.HouseUnit = string.IsNullOrWhiteSpace(houseUnit) ? null : houseUnit.Trim();
        user.Street = string.IsNullOrWhiteSpace(street) ? null : street.Trim();
        user.Barangay = string.IsNullOrWhiteSpace(barangay) ? null : barangay.Trim();
        user.City = string.IsNullOrWhiteSpace(city) ? null : city.Trim();
        user.Province = string.IsNullOrWhiteSpace(province) ? null : province.Trim();
        user.ZipCode = string.IsNullOrWhiteSpace(zipCode) ? null : zipCode.Trim();
        user.RefreshFullName();
        if (string.IsNullOrWhiteSpace(user.FullName))
            user.FullName = $"{user.FirstName} {user.LastName}".Trim();
    }

    private async Task<UserDto> MapAsync(ApplicationUser u)
    {
        var roles = await _userManager.GetRolesAsync(u);
        return new UserDto(
            u.Id,
            u.Email ?? string.Empty,
            u.FullName,
            u.FirstName,
            u.MiddleName,
            u.LastName,
            u.DateOfBirth,
            u.Mobile,
            u.Phone,
            u.HouseUnit,
            u.Street,
            u.Barangay,
            u.City,
            u.Province,
            u.ZipCode,
            u.FormatAddress(),
            !string.IsNullOrWhiteSpace(u.ProfilePictureStoredFileName),
            roles.FirstOrDefault() ?? string.Empty,
            u.BranchId,
            u.Branch?.Name,
            IsActive(u),
            u.IsDeleted,
            u.DeletedAt);
    }

    private static bool IsActive(ApplicationUser u) =>
        !u.IsDeleted &&
        (!u.LockoutEnabled || u.LockoutEnd is null || u.LockoutEnd <= DateTimeOffset.UtcNow);
}
