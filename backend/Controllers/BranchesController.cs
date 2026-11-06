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
[Route("api/branches")]
[Authorize]
public class BranchesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BranchScopeService _branchScope;

    public BranchesController(AppDbContext db, BranchScopeService branchScope)
    {
        _db = db;
        _branchScope = branchScope;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BranchDto>>> GetAll(
        [FromQuery] bool activeOnly = false,
        [FromQuery] int? branchId = null)
    {
        var canSettings = User.HasClaim("permission", PermissionCodes.BranchesView);
        var canCustomers = User.HasClaim("permission", PermissionCodes.CustomersView);
        var canUsers = User.HasClaim("permission", PermissionCodes.UsersView);
        if (!canSettings && !canCustomers && !canUsers) return Forbid();

        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var query = BranchScopeService.Branches(_db.Branches.AsQueryable(), scope);
        if (activeOnly || !canSettings)
            query = query.Where(b => b.IsActive);

        var list = await query
            .OrderBy(b => b.Name)
            .Select(b => new BranchDto(
                b.Id,
                b.Name,
                b.Code,
                b.Address,
                b.Barangay,
                b.City,
                b.Province,
                b.ZipCode,
                b.Phone,
                b.Email,
                FormatAddress(b.Address, b.Barangay, b.City, b.Province, b.ZipCode),
                b.IsActive,
                b.Customers.Count,
                b.Users.Count(u => !u.IsDeleted),
                b.CreatedAt))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.BranchesView}")]
    public async Task<ActionResult<BranchDto>> Get(int id)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();
        if (!BranchScopeService.CanAccessBranch(scope, id)) return NotFound();

        var b = await _db.Branches
            .Where(x => x.Id == id)
            .Select(x => new BranchDto(
                x.Id,
                x.Name,
                x.Code,
                x.Address,
                x.Barangay,
                x.City,
                x.Province,
                x.ZipCode,
                x.Phone,
                x.Email,
                FormatAddress(x.Address, x.Barangay, x.City, x.Province, x.ZipCode),
                x.IsActive,
                x.Customers.Count,
                x.Users.Count(u => !u.IsDeleted),
                x.CreatedAt))
            .FirstOrDefaultAsync();
        return b is null ? NotFound() : Ok(b);
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.BranchesManage}")]
    public async Task<ActionResult<BranchDto>> Create([FromBody] UpsertBranchRequest request)
    {
        var name = request.Name.Trim();
        if (await _db.Branches.AnyAsync(b => b.Name == name))
            return BadRequest(new { message = "A branch with this name already exists." });

        var code = TrimOrNull(request.Code);
        if (code is not null && await _db.Branches.AnyAsync(b => b.Code == code))
            return BadRequest(new { message = "A branch with this code already exists." });

        var branch = new Branch
        {
            Name = name,
            Code = code,
            Address = TrimOrNull(request.Address),
            Barangay = TrimOrNull(request.Barangay),
            City = TrimOrNull(request.City),
            Province = TrimOrNull(request.Province),
            ZipCode = TrimOrNull(request.ZipCode),
            Phone = TrimOrNull(request.Phone),
            Email = TrimOrNull(request.Email),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.Branches.Add(branch);
        await _db.SaveChangesAsync();
        return Created($"/api/branches/{branch.Id}", Map(branch, 0, 0));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.BranchesManage}")]
    public async Task<ActionResult<BranchDto>> Update(int id, [FromBody] UpsertBranchRequest request)
    {
        var branch = await _db.Branches
            .Include(b => b.Customers)
            .Include(b => b.Users)
            .FirstOrDefaultAsync(b => b.Id == id);
        if (branch is null) return NotFound();

        var name = request.Name.Trim();
        if (await _db.Branches.AnyAsync(b => b.Name == name && b.Id != id))
            return BadRequest(new { message = "A branch with this name already exists." });

        var code = TrimOrNull(request.Code);
        if (code is not null && await _db.Branches.AnyAsync(b => b.Code == code && b.Id != id))
            return BadRequest(new { message = "A branch with this code already exists." });

        branch.Name = name;
        branch.Code = code;
        branch.Address = TrimOrNull(request.Address);
        branch.Barangay = TrimOrNull(request.Barangay);
        branch.City = TrimOrNull(request.City);
        branch.Province = TrimOrNull(request.Province);
        branch.ZipCode = TrimOrNull(request.ZipCode);
        branch.Phone = TrimOrNull(request.Phone);
        branch.Email = TrimOrNull(request.Email);
        branch.IsActive = request.IsActive;
        branch.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(Map(branch, branch.Customers.Count, branch.Users.Count(u => !u.IsDeleted)));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.BranchesManage}")]
    public async Task<IActionResult> Delete(int id)
    {
        var branch = await _db.Branches
            .Include(b => b.Customers)
            .Include(b => b.Users)
            .FirstOrDefaultAsync(b => b.Id == id);
        if (branch is null) return NotFound();
        if (branch.Customers.Count > 0)
            return BadRequest(new { message = "Cannot delete a branch that still has customers. Reassign them first." });
        if (branch.Users.Any(u => !u.IsDeleted))
            return BadRequest(new { message = "Cannot delete a branch that still has users. Reassign them first." });

        _db.Branches.Remove(branch);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static BranchDto Map(Branch b, int customerCount, int userCount) => new(
        b.Id,
        b.Name,
        b.Code,
        b.Address,
        b.Barangay,
        b.City,
        b.Province,
        b.ZipCode,
        b.Phone,
        b.Email,
        b.FormatAddress(),
        b.IsActive,
        customerCount,
        userCount,
        b.CreatedAt);

    private static string FormatAddress(string? address, string? barangay, string? city, string? province, string? zip) =>
        string.Join(", ", new[] { address, barangay, city, province, zip }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim()));

    private static string? TrimOrNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
