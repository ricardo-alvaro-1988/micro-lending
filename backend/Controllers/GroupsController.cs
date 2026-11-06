using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/groups")]
[Authorize]
public class GroupsController : ControllerBase
{
    private readonly AppDbContext _db;

    public GroupsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CustomerGroupDto>>> GetAll([FromQuery] bool activeOnly = false)
    {
        var canSettings = User.HasClaim("permission", PermissionCodes.GroupsView);
        var canCustomers = User.HasClaim("permission", PermissionCodes.CustomersView);
        if (!canSettings && !canCustomers) return Forbid();

        var query = _db.CustomerGroups.AsQueryable();
        if (activeOnly || !canSettings)
            query = query.Where(g => g.IsActive);

        var list = await query
            .OrderBy(g => g.Name)
            .Select(g => new CustomerGroupDto(
                g.Id,
                g.Name,
                g.Description,
                g.IsActive,
                g.Customers.Count,
                g.CreatedAt))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.GroupsView}")]
    public async Task<ActionResult<CustomerGroupDto>> Get(int id)
    {
        var g = await _db.CustomerGroups
            .Where(x => x.Id == id)
            .Select(x => new CustomerGroupDto(
                x.Id,
                x.Name,
                x.Description,
                x.IsActive,
                x.Customers.Count,
                x.CreatedAt))
            .FirstOrDefaultAsync();
        return g is null ? NotFound() : Ok(g);
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.GroupsManage}")]
    public async Task<ActionResult<CustomerGroupDto>> Create([FromBody] UpsertCustomerGroupRequest request)
    {
        var name = request.Name.Trim();
        if (await _db.CustomerGroups.AnyAsync(g => g.Name == name))
            return BadRequest(new { message = "A group with this name already exists." });

        var group = new CustomerGroup
        {
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.CustomerGroups.Add(group);
        await _db.SaveChangesAsync();
        return Created($"/api/groups/{group.Id}", new CustomerGroupDto(group.Id, group.Name, group.Description, group.IsActive, 0, group.CreatedAt));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.GroupsManage}")]
    public async Task<ActionResult<CustomerGroupDto>> Update(int id, [FromBody] UpsertCustomerGroupRequest request)
    {
        var group = await _db.CustomerGroups.Include(g => g.Customers).FirstOrDefaultAsync(g => g.Id == id);
        if (group is null) return NotFound();

        var name = request.Name.Trim();
        if (await _db.CustomerGroups.AnyAsync(g => g.Name == name && g.Id != id))
            return BadRequest(new { message = "A group with this name already exists." });

        group.Name = name;
        group.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        group.IsActive = request.IsActive;
        group.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new CustomerGroupDto(group.Id, group.Name, group.Description, group.IsActive, group.Customers.Count, group.CreatedAt));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.GroupsManage}")]
    public async Task<IActionResult> Delete(int id)
    {
        var group = await _db.CustomerGroups.Include(g => g.Customers).FirstOrDefaultAsync(g => g.Id == id);
        if (group is null) return NotFound();
        if (group.Customers.Count > 0)
            return BadRequest(new { message = "Cannot delete a group that still has customers. Reassign them first." });

        _db.CustomerGroups.Remove(group);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
