using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
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

    public ProfileController(UserManager<ApplicationUser> userManager, AppDbContext db)
    {
        _userManager = userManager;
        _db = db;
    }

    [HttpPut]
    public async Task<ActionResult<AuthUserResponse>> Update([FromBody] UpdateProfileRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        user.FullName = request.FullName.Trim();
        await _userManager.UpdateAsync(user);
        if (user.Branch is null && user.BranchId is not null)
            await _db.Entry(user).Reference(u => u.Branch).LoadAsync();

        var roles = await _userManager.GetRolesAsync(user);
        var permissions = User.Claims.Where(c => c.Type == "permission").Select(c => c.Value).ToList();

        return Ok(new AuthUserResponse(
            user.Id,
            user.Email ?? string.Empty,
            user.FullName,
            roles.FirstOrDefault() ?? string.Empty,
            roles.Contains("Admin"),
            user.BranchId,
            user.Branch?.Name,
            permissions));
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
}
