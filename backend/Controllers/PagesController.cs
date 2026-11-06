using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
using MicroLending.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PagesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;

    public PagesController(AppDbContext db, AuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.PagesView}")]
    public async Task<ActionResult<IEnumerable<AppPageDto>>> GetPages()
    {
        var pages = await _db.AppPages
            .Include(p => p.Permission)
            .OrderBy(p => p.SortOrder)
            .Select(p => new AppPageDto(
                p.Id, p.Code, p.Name, p.Path, p.GroupName, p.SortOrder, p.Permission.Code))
            .ToListAsync();
        return Ok(pages);
    }

    [HttpGet("permissions")]
    [Authorize(Policy = $"perm:{PermissionCodes.PagesView}")]
    public async Task<ActionResult<IEnumerable<PermissionDto>>> GetPermissions()
    {
        var list = await _db.Permissions
            .OrderBy(p => p.Module).ThenBy(p => p.Name)
            .Select(p => new PermissionDto(p.Id, p.Code, p.Name, p.Module))
            .ToListAsync();
        return Ok(list);
    }

    /// <summary>Page accessibility matrix: which pages each role can open.</summary>
    [HttpGet("access")]
    [Authorize(Policy = $"perm:{PermissionCodes.PagesView}")]
    public async Task<ActionResult<IEnumerable<RolePageAccessDto>>> GetAccess()
    {
        var roles = await _db.Roles.OrderBy(r => r.Name).ToListAsync();
        var pages = await _db.AppPages.Include(p => p.Permission).ToListAsync();
        var rolePerms = await _db.RolePermissions
            .Select(rp => new { rp.RoleId, Code = rp.Permission.Code })
            .ToListAsync();

        var result = roles.Select(role =>
        {
            var codes = rolePerms.Where(rp => rp.RoleId == role.Id).Select(rp => rp.Code).ToHashSet();
            var pageCodes = pages
                .Where(p => codes.Contains(p.Permission.Code))
                .Select(p => p.Code)
                .ToList();
            return new RolePageAccessDto(role.Id, role.Name!, pageCodes);
        });

        return Ok(result);
    }

    [HttpPut("access/{roleId}")]
    [Authorize(Policy = $"perm:{PermissionCodes.PagesManage}")]
    public async Task<ActionResult<RolePageAccessDto>> SetAccess(string roleId, [FromBody] SetRolePagesRequest request)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Id == roleId);
        if (role is null) return NotFound();

        var pages = await _db.AppPages.Include(p => p.Permission).ToListAsync();
        var selected = pages.Where(p => request.PageCodes.Contains(p.Code)).ToList();

        // Map selected pages -> permission codes; keep non-page permissions (e.g. *.manage) already on role
        var pagePermCodes = pages.Select(p => p.Permission.Code).ToHashSet();
        var existing = await _db.RolePermissions
            .Include(rp => rp.Permission)
            .Where(rp => rp.RoleId == roleId)
            .ToListAsync();

        var keep = existing
            .Where(rp => !pagePermCodes.Contains(rp.Permission.Code))
            .Select(rp => rp.PermissionId)
            .ToHashSet();

        // Grant matching *.manage permission with each selected page's *.view
        foreach (var page in selected)
        {
            keep.Add(page.PermissionId);
            if (page.Permission.Code.EndsWith(".view", StringComparison.Ordinal))
            {
                var manageCode = page.Permission.Code[..^5] + ".manage";
                var manage = await _db.Permissions.FirstOrDefaultAsync(p => p.Code == manageCode);
                if (manage is not null) keep.Add(manage.Id);
            }
        }

        if (role.IsSystem)
        {
            var required = await _db.Permissions
                .Where(p => p.Code == PermissionCodes.RolesManage || p.Code == PermissionCodes.UsersManage)
                .Select(p => p.Id)
                .ToListAsync();
            foreach (var id in required) keep.Add(id);
        }

        _db.RolePermissions.RemoveRange(existing);
        foreach (var pid in keep)
        {
            _db.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = pid });
        }
        await _db.SaveChangesAsync();

        var pageCodes = pages.Where(p => keep.Contains(p.PermissionId)).Select(p => p.Code).ToList();
        await _audit.LogAsync(
            "Updated",
            "RolePageAccess",
            role.Id,
            $"Updated page access for role '{role.Name}' ({pageCodes.Count} pages)",
            new { role.Name, PageCodes = pageCodes });
        return Ok(new RolePageAccessDto(role.Id, role.Name!, pageCodes));
    }
}
