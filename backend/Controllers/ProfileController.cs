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
[Authorize(Policy = $"perm:{PermissionCodes.ProfileView}")]
public class ProfileController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _db;
    private readonly CustomerDocumentStorage _storage;

    public ProfileController(UserManager<ApplicationUser> userManager, AppDbContext db, CustomerDocumentStorage storage)
    {
        _userManager = userManager;
        _db = db;
        _storage = storage;
    }

    [HttpGet]
    public async Task<ActionResult<AuthUserResponse>> Get()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (user.Branch is null && user.BranchId is not null)
            await _db.Entry(user).Reference(u => u.Branch).LoadAsync();
        return Ok(await MapAsync(user));
    }

    [HttpPut]
    public async Task<ActionResult<AuthUserResponse>> Update([FromBody] UpdateProfileRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        user.FirstName = request.FirstName.Trim();
        user.MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? null : request.MiddleName.Trim();
        user.LastName = request.LastName.Trim();
        user.DateOfBirth = request.DateOfBirth;
        user.Mobile = string.IsNullOrWhiteSpace(request.Mobile) ? null : request.Mobile.Trim();
        user.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        user.HouseUnit = string.IsNullOrWhiteSpace(request.HouseUnit) ? null : request.HouseUnit.Trim();
        user.Street = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street.Trim();
        user.Barangay = string.IsNullOrWhiteSpace(request.Barangay) ? null : request.Barangay.Trim();
        user.City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim();
        user.Province = string.IsNullOrWhiteSpace(request.Province) ? null : request.Province.Trim();
        user.ZipCode = string.IsNullOrWhiteSpace(request.ZipCode) ? null : request.ZipCode.Trim();
        user.RefreshFullName();
        if (string.IsNullOrWhiteSpace(user.FullName))
            user.FullName = $"{user.FirstName} {user.LastName}".Trim();

        await _userManager.UpdateAsync(user);
        if (user.Branch is null && user.BranchId is not null)
            await _db.Entry(user).Reference(u => u.Branch).LoadAsync();

        return Ok(await MapAsync(user));
    }

    [HttpPost("profile-picture")]
    [RequestSizeLimit(6_000_000)]
    public async Task<ActionResult<object>> UploadProfilePicture([FromForm] IFormFile? file)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
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

    [HttpGet("profile-picture")]
    public async Task<IActionResult> GetProfilePicture()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(user.ProfilePictureStoredFileName)) return NotFound();

        var path = _storage.GetUserPhysicalPath(user.Id, user.ProfilePictureStoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound(new { message = "Profile picture missing on disk." });
        return PhysicalFile(path, user.ProfilePictureContentType ?? "image/jpeg");
    }

    [HttpDelete("profile-picture")]
    public async Task<IActionResult> DeleteProfilePicture()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(user.ProfilePictureStoredFileName)) return NoContent();

        _storage.DeleteUserFileIfExists(user.Id, user.ProfilePictureStoredFileName);
        user.ProfilePictureStoredFileName = null;
        user.ProfilePictureContentType = null;
        await _userManager.UpdateAsync(user);
        return NoContent();
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });
        }

        return NoContent();
    }

    private async Task<AuthUserResponse> MapAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var permissions = User.Claims.Where(c => c.Type == "permission").Select(c => c.Value).ToList();
        return new AuthUserResponse(
            user.Id,
            user.Email ?? string.Empty,
            user.FullName,
            roles.FirstOrDefault() ?? string.Empty,
            roles.Contains("Admin"),
            user.BranchId,
            user.Branch?.Name,
            permissions,
            user.FirstName,
            user.MiddleName,
            user.LastName,
            user.DateOfBirth,
            user.Mobile,
            user.Phone,
            user.HouseUnit,
            user.Street,
            user.Barangay,
            user.City,
            user.Province,
            user.ZipCode,
            user.FormatAddress(),
            !string.IsNullOrWhiteSpace(user.ProfilePictureStoredFileName));
    }
}
