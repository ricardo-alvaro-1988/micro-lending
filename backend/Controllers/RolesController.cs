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
public class RolesController : ControllerBase
{
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly AppDbContext _db;
    private readonly AuditService _audit;

    public RolesController(RoleManager<ApplicationRole> roleManager, AppDbContext db, AuditService audit)
    {
        _roleManager = roleManager;
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.RolesView}")]
    public async Task<ActionResult<IEnumerable<RoleDto>>> GetAll()
    {
        var roles = await _db.Roles.OrderBy(r => r.Name).ToListAsync();
        var result = new List<RoleDto>();
        foreach (var role in roles)
        {
            var perms = await _db.RolePermissions
                .Where(rp => rp.RoleId == role.Id)
                .Select(rp => rp.Permission.Code)
                .ToListAsync();
            result.Add(new RoleDto(role.Id, role.Name!, role.Description, role.IsSystem, perms));
        }
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.RolesManage}")]
    public async Task<ActionResult<RoleDto>> Create([FromBody] CreateRoleRequest request)
    {
        if (await _roleManager.RoleExistsAsync(request.Name))
        {
            return Conflict(new { message = "Role name already exists." });
        }

        var role = new ApplicationRole
        {
            Name = request.Name.Trim(),
            Description = request.Description,
            IsSystem = false
        };

        var result = await _roleManager.CreateAsync(role);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });
        }

        // Default: profile + dashboard view
        var defaults = await _db.Permissions
            .Where(p => p.Code == PermissionCodes.DashboardView || p.Code == PermissionCodes.ProfileView)
            .ToListAsync();
        foreach (var p in defaults)
        {
            _db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = p.Id });
        }
        await _db.SaveChangesAsync();

        var codes = defaults.Select(p => p.Code).ToList();
        await _audit.LogAsync(
            "Created",
            "Role",
            role.Id,
            $"Created role '{role.Name}'",
            new { role.Name, role.Description, DefaultPermissions = codes });
        return CreatedAtAction(nameof(GetAll), new RoleDto(role.Id, role.Name!, role.Description, role.IsSystem, codes));
    }

    [HttpPut("{id}")]
    [Authorize(Policy = $"perm:{PermissionCodes.RolesManage}")]
    public async Task<ActionResult<RoleDto>> Update(string id, [FromBody] UpdateRoleRequest request)
    {
        var role = await _roleManager.FindByIdAsync(id);
        if (role is null) return NotFound();

        if (role.IsSystem && !string.Equals(role.Name, request.Name, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Cannot rename the system Admin role." });
        }

        var nameTaken = await _db.Roles.AnyAsync(r => r.Name == request.Name && r.Id != id);
        if (nameTaken) return Conflict(new { message = "Role name already exists." });

        var previousName = role.Name;
        role.Name = request.Name.Trim();
        role.NormalizedName = _roleManager.NormalizeKey(role.Name);
        role.Description = request.Description;
        await _roleManager.UpdateAsync(role);

        var perms = await _db.RolePermissions
            .Where(rp => rp.RoleId == role.Id)
            .Select(rp => rp.Permission.Code)
            .ToListAsync();

        await _audit.LogAsync(
            "Updated",
            "Role",
            role.Id,
            $"Updated role '{previousName}' → '{role.Name}'",
            new { PreviousName = previousName, role.Name, role.Description });

        return Ok(new RoleDto(role.Id, role.Name!, role.Description, role.IsSystem, perms));
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = $"perm:{PermissionCodes.RolesManage}")]
    public async Task<IActionResult> Delete(string id)
    {
        var role = await _roleManager.FindByIdAsync(id);
        if (role is null) return NotFound();
        if (role.IsSystem) return BadRequest(new { message = "Cannot delete the system Admin role." });

        var inUse = await _db.UserRoles.AnyAsync(ur => ur.RoleId == id);
        if (inUse) return BadRequest(new { message = "Role is assigned to users. Reassign users first." });

        var roleName = role.Name;
        var rps = _db.RolePermissions.Where(rp => rp.RoleId == id);
        _db.RolePermissions.RemoveRange(rps);
        await _db.SaveChangesAsync();
        await _roleManager.DeleteAsync(role);
        await _audit.LogAsync("Deleted", "Role", id, $"Deleted role '{roleName}'");
        return NoContent();
    }

    [HttpPut("{id}/permissions")]
    [Authorize(Policy = $"perm:{PermissionCodes.RolesManage}")]
    public async Task<ActionResult<RoleDto>> SetPermissions(string id, [FromBody] SetRolePermissionsRequest request)
    {
        var role = await _roleManager.FindByIdAsync(id);
        if (role is null) return NotFound();

        var codes = request.PermissionCodes.Distinct().ToList();
        if (role.IsSystem)
        {
            foreach (var required in new[] { PermissionCodes.RolesManage, PermissionCodes.UsersManage })
            {
                if (!codes.Contains(required)) codes.Add(required);
            }
        }

        var existing = _db.RolePermissions.Where(rp => rp.RoleId == id);
        _db.RolePermissions.RemoveRange(existing);

        var perms = await _db.Permissions.Where(p => codes.Contains(p.Code)).ToListAsync();
        foreach (var p in perms)
        {
            _db.RolePermissions.Add(new RolePermission { RoleId = id, PermissionId = p.Id });
        }
        await _db.SaveChangesAsync();

        var permCodes = perms.Select(p => p.Code).ToList();
        await _audit.LogAsync(
            "Updated",
            "RolePermissions",
            role.Id,
            $"Updated permissions for role '{role.Name}' ({permCodes.Count} permissions)",
            new { role.Name, Permissions = permCodes });

        return Ok(new RoleDto(role.Id, role.Name!, role.Description, role.IsSystem, permCodes));
    }
}
