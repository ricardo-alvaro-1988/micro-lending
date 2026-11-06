using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
using MicroLending.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly JwtTokenService _jwt;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        JwtTokenService jwt)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _jwt = jwt;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null || user.IsDeleted)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (user.LockoutEnabled && user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow)
        {
            return Unauthorized(new { message = "This account is deactivated. Contact an administrator." });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var (token, expires, authUser) = await _jwt.CreateTokenAsync(user);
        return Ok(new LoginResponse(token, expires, MapUser(authUser)));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        // Re-issue token so newly granted permissions (e.g. groups.*) apply without a full re-login.
        var (token, expires, authUser) = await _jwt.CreateTokenAsync(user);
        return Ok(new LoginResponse(token, expires, MapUser(authUser)));
    }

    private static AuthUserResponse MapUser(Services.AuthUserDto authUser) =>
        new(
            authUser.Id,
            authUser.Email,
            authUser.FullName,
            authUser.Role,
            authUser.IsAdmin,
            authUser.BranchId,
            authUser.BranchName,
            authUser.Permissions);
}
