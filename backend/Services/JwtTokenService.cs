using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MicroLending.Api.Data;
using MicroLending.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace MicroLending.Api.Services;

public class JwtTokenService
{
    private readonly IConfiguration _config;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _db;

    public JwtTokenService(
        IConfiguration config,
        UserManager<ApplicationUser> userManager,
        AppDbContext db)
    {
        _config = config;
        _userManager = userManager;
        _db = db;
    }

    public async Task<(string Token, DateTime ExpiresAt, AuthUserDto User)> CreateTokenAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var roleName = roles.FirstOrDefault() ?? string.Empty;
        var isAdmin = roles.Contains("Admin");

        if (user.Branch is null && user.BranchId is not null)
            await _db.Entry(user).Reference(u => u.Branch).LoadAsync();

        var permissions = new List<string>();
        if (!string.IsNullOrEmpty(roleName))
        {
            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
            if (role is not null)
            {
                permissions = await _db.RolePermissions
                    .Where(rp => rp.RoleId == role.Id)
                    .Select(rp => rp.Permission.Code)
                    .ToListAsync();
            }
        }

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new("fullName", user.FullName),
            new(ClaimTypes.Role, roleName),
            new("role", roleName),
            new("isAdmin", isAdmin ? "true" : "false"),
        };

        if (user.BranchId is int branchId)
            claims.Add(new Claim("branchId", branchId.ToString()));

        foreach (var p in permissions)
        {
            claims.Add(new Claim("permission", p));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(double.Parse(_config["Jwt:ExpireHours"] ?? "12"));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        var dto = new AuthUserDto(
            user.Id,
            user.Email ?? string.Empty,
            user.FullName,
            roleName,
            isAdmin,
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
        return (new JwtSecurityTokenHandler().WriteToken(token), expires, dto);
    }
}

public record AuthUserDto(
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
