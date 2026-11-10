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
[Route("api/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CustomerDocumentStorage _storage;
    private readonly BranchScopeService _branchScope;

    public CustomersController(AppDbContext db, CustomerDocumentStorage storage, BranchScopeService branchScope)
    {
        _db = db;
        _storage = storage;
        _branchScope = branchScope;
    }

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersView}")]
    public async Task<ActionResult<IEnumerable<CustomerListItemDto>>> GetAll(
        [FromQuery] string? q = null,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var query = BranchScopeService.Customers(_db.Customers.AsQueryable(), scope);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(c =>
                c.FullName.Contains(term) ||
                (c.Mobile != null && c.Mobile.Contains(term)) ||
                (c.Email != null && c.Email.Contains(term)));
        }

        var list = await query
            .OrderBy(c => c.LastName).ThenBy(c => c.FirstName)
            .Select(c => new CustomerListItemDto(
                c.Id,
                c.FirstName,
                c.MiddleName,
                c.LastName,
                c.FullName,
                c.BranchId,
                c.Branch != null ? c.Branch.Name : null,
                c.GroupId,
                c.Group != null ? c.Group.Name : null,
                c.Agent1UserId,
                c.Agent1 != null ? c.Agent1.FullName : null,
                c.Mobile,
                c.Email,
                c.City,
                c.ReferredBy,
                c.Documents.Count,
                c.ProfilePictureStoredFileName != null,
                c.CreatedAt))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CustomerDetailDto>> Get(int id)
    {
        if (!PermissionChecks.CanReviewLoanApplication(User)) return Forbid();

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var c = await LoadCustomerAsync(id);
        if (c is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, c)) return NotFound();
        return Ok(MapDetail(c));
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersManage}")]
    public async Task<ActionResult<CustomerDetailDto>> Create([FromBody] UpsertCustomerRequest request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        request.BranchId = BranchScopeService.EnforceWriteBranchId(scope, request.BranchId);
        if (!scope.IsAdmin && request.BranchId is null)
            return BadRequest(new { message = "Your user account has no branch assigned. Ask an admin to set your branch." });

        var branchError = await ValidateBranchAsync(request.BranchId);
        if (branchError is not null) return BadRequest(new { message = branchError });
        var groupError = await ValidateGroupAsync(request.GroupId);
        if (groupError is not null) return BadRequest(new { message = groupError });
        var agentError = await ValidateAgentsAsync(request, scope);
        if (agentError is not null) return BadRequest(new { message = agentError });

        var customer = new Customer();
        Apply(customer, request);
        customer.CreatedAt = DateTime.UtcNow;
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();
        var created = await LoadCustomerAsync(customer.Id);
        return Created($"/api/customers/{customer.Id}", MapDetail(created!));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersManage}")]
    public async Task<ActionResult<CustomerDetailDto>> Update(int id, [FromBody] UpsertCustomerRequest request)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await LoadCustomerAsync(id);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();

        request.BranchId = BranchScopeService.EnforceWriteBranchId(scope, request.BranchId);
        if (!scope.IsAdmin && request.BranchId is null)
            return BadRequest(new { message = "Your user account has no branch assigned. Ask an admin to set your branch." });

        var branchError = await ValidateBranchAsync(request.BranchId, customer.BranchId);
        if (branchError is not null) return BadRequest(new { message = branchError });
        var groupError = await ValidateGroupAsync(request.GroupId, customer.GroupId);
        if (groupError is not null) return BadRequest(new { message = groupError });
        var agentError = await ValidateAgentsAsync(request, scope);
        if (agentError is not null) return BadRequest(new { message = agentError });

        Apply(customer, request);
        await _db.SaveChangesAsync();
        var updated = await LoadCustomerAsync(id);
        return Ok(MapDetail(updated!));
    }

    [HttpPost("{id:int}/profile-picture")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersManage}")]
    [RequestSizeLimit(6_000_000)]
    public async Task<ActionResult<object>> UploadProfilePicture(int id, [FromForm] IFormFile? file)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();
        if (file is null || file.Length <= 0) return BadRequest(new { message = "Image file is required." });

        try
        {
            if (!string.IsNullOrWhiteSpace(customer.ProfilePictureStoredFileName))
                _storage.DeleteIfExists(id, customer.ProfilePictureStoredFileName);

            var saved = await _storage.SaveProfilePictureAsync(id, file);
            customer.ProfilePictureStoredFileName = saved.StoredFileName;
            customer.ProfilePictureContentType = saved.ContentType;
            customer.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
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

    [HttpGet("{id:int}/profile-picture")]
    public async Task<IActionResult> GetProfilePicture(int id)
    {
        if (!PermissionChecks.CanReviewLoanApplication(User)) return Forbid();

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();
        if (string.IsNullOrWhiteSpace(customer.ProfilePictureStoredFileName)) return NotFound();

        var path = _storage.GetPhysicalPath(id, customer.ProfilePictureStoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound(new { message = "Profile picture missing on disk." });
        return PhysicalFile(path, customer.ProfilePictureContentType ?? "image/jpeg");
    }

    [HttpDelete("{id:int}/profile-picture")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersManage}")]
    public async Task<IActionResult> DeleteProfilePicture(int id)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();
        if (string.IsNullOrWhiteSpace(customer.ProfilePictureStoredFileName)) return NoContent();

        _storage.DeleteIfExists(id, customer.ProfilePictureStoredFileName);
        customer.ProfilePictureStoredFileName = null;
        customer.ProfilePictureContentType = null;
        customer.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/documents")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersManage}")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<CustomerDocumentDto>> UploadDocument(
        int id,
        [FromForm] string label,
        [FromForm] IFormFile? file)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();
        if (string.IsNullOrWhiteSpace(label)) return BadRequest(new { message = "Document label is required." });
        if (file is null || file.Length <= 0) return BadRequest(new { message = "File is required." });

        try
        {
            var saved = await _storage.SaveAsync(id, file);
            var doc = new CustomerDocument
            {
                CustomerId = id,
                Label = label.Trim(),
                OriginalFileName = Path.GetFileName(file.FileName),
                StoredFileName = saved.StoredFileName,
                ContentType = saved.ContentType,
                SizeBytes = saved.Size,
                UploadedAt = DateTime.UtcNow,
            };
            _db.CustomerDocuments.Add(doc);
            await _db.SaveChangesAsync();
            return Ok(new CustomerDocumentDto(doc.Id, doc.Label, doc.OriginalFileName, doc.ContentType, doc.SizeBytes, doc.UploadedAt));
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

    [HttpGet("{id:int}/documents/{docId:int}/file")]
    public async Task<IActionResult> Download(int id, int docId)
    {
        if (!PermissionChecks.CanReviewLoanApplication(User)) return Forbid();

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();

        var doc = await _db.CustomerDocuments.FirstOrDefaultAsync(d => d.Id == docId && d.CustomerId == id);
        if (doc is null) return NotFound();
        var path = _storage.GetPhysicalPath(id, doc.StoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound(new { message = "File missing on disk." });
        return PhysicalFile(path, doc.ContentType, doc.OriginalFileName);
    }

    [HttpDelete("{id:int}/documents/{docId:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.CustomersManage}")]
    public async Task<IActionResult> DeleteDocument(int id, int docId)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return NotFound();
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return NotFound();

        var doc = await _db.CustomerDocuments.FirstOrDefaultAsync(d => d.Id == docId && d.CustomerId == id);
        if (doc is null) return NotFound();
        _storage.DeleteIfExists(id, doc.StoredFileName);
        _db.CustomerDocuments.Remove(doc);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private Task<Customer?> LoadCustomerAsync(int id) =>
        _db.Customers
            .Include(x => x.Documents)
            .Include(x => x.Branch)
            .Include(x => x.Group)
            .Include(x => x.Agent1)
            .Include(x => x.Agent2)
            .Include(x => x.Agent3)
            .FirstOrDefaultAsync(x => x.Id == id);

    private async Task<string?> ValidateBranchAsync(int? branchId, int? currentBranchId = null)
    {
        if (branchId is null) return null;
        var branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId.Value);
        if (branch is null) return "Selected branch was not found.";
        if (!branch.IsActive && branchId != currentBranchId) return "Selected branch is inactive.";
        return null;
    }

    private async Task<string?> ValidateGroupAsync(int? groupId, int? currentGroupId = null)
    {
        if (groupId is null) return null;
        var group = await _db.CustomerGroups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId.Value);
        if (group is null) return "Selected group was not found.";
        if (!group.IsActive && groupId != currentGroupId) return "Selected group is inactive.";
        return null;
    }

    private async Task<string?> ValidateAgentsAsync(UpsertCustomerRequest request, BranchScope scope)
    {
        var agent1 = TrimOrNull(request.Agent1UserId);
        if (agent1 is null) return "Collection agent 1 is required.";

        var agent2 = TrimOrNull(request.Agent2UserId);
        var agent3 = TrimOrNull(request.Agent3UserId);
        var ids = new[] { agent1, agent2, agent3 }.Where(x => x is not null).Cast<string>().ToList();
        if (ids.Count != ids.Distinct(StringComparer.OrdinalIgnoreCase).Count())
            return "Each collection agent must be unique.";

        var users = await _db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id) && !u.IsDeleted)
            .ToListAsync();
        if (users.Count != ids.Count) return "One or more collection agents were not found.";

        var customerBranchId = request.BranchId ?? scope.UserBranchId;
        foreach (var agent in users)
        {
            if (agent.BranchId is null) continue;
            if (customerBranchId is not null && agent.BranchId != customerBranchId)
                return $"Collection agent {agent.FullName} belongs to another branch.";
            if (!scope.IsAdmin && scope.UserBranchId is not null && agent.BranchId != scope.UserBranchId)
                return $"Collection agent {agent.FullName} belongs to another branch.";
        }

        return null;
    }

    private static void Apply(Customer customer, UpsertCustomerRequest request)
    {
        customer.FirstName = request.FirstName.Trim();
        customer.MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? null : request.MiddleName.Trim();
        customer.LastName = request.LastName.Trim();
        customer.FullName = string.Join(' ', new[] { customer.FirstName, customer.MiddleName, customer.LastName }
            .Where(x => !string.IsNullOrWhiteSpace(x)));
        customer.BranchId = request.BranchId;
        customer.GroupId = request.GroupId;
        customer.Agent1UserId = TrimOrNull(request.Agent1UserId)!;
        customer.Agent2UserId = TrimOrNull(request.Agent2UserId);
        customer.Agent3UserId = TrimOrNull(request.Agent3UserId);
        customer.HouseUnit = TrimOrNull(request.HouseUnit);
        customer.Street = TrimOrNull(request.Street);
        customer.Barangay = TrimOrNull(request.Barangay);
        customer.City = TrimOrNull(request.City);
        customer.Province = TrimOrNull(request.Province);
        customer.ZipCode = TrimOrNull(request.ZipCode);
        customer.Mobile = TrimOrNull(request.Mobile);
        customer.Phone = TrimOrNull(request.Phone);
        customer.Email = TrimOrNull(request.Email);
        customer.ReferredBy = TrimOrNull(request.ReferredBy);
        customer.DateOfBirth = request.DateOfBirth;
        customer.IdType = TrimOrNull(request.IdType);
        customer.IdNumber = TrimOrNull(request.IdNumber);
        customer.CoMakerName = TrimOrNull(request.CoMakerName);
        customer.CoMakerMobile = TrimOrNull(request.CoMakerMobile);
        customer.CoMakerIdNumber = TrimOrNull(request.CoMakerIdNumber);
        customer.GuarantorName = TrimOrNull(request.GuarantorName);
        customer.GuarantorMobile = TrimOrNull(request.GuarantorMobile);
        customer.GuarantorIdNumber = TrimOrNull(request.GuarantorIdNumber);
        customer.Latitude = request.Latitude;
        customer.Longitude = request.Longitude;
        customer.UpdatedAt = DateTime.UtcNow;
    }

    private static string? TrimOrNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static CustomerDetailDto MapDetail(Customer c) =>
        new(
            c.Id,
            c.FirstName,
            c.MiddleName,
            c.LastName,
            c.FullName,
            c.BranchId,
            c.Branch?.Name,
            c.GroupId,
            c.Group?.Name,
            c.Agent1UserId,
            c.Agent1?.FullName,
            c.Agent2UserId,
            c.Agent2?.FullName,
            c.Agent3UserId,
            c.Agent3?.FullName,
            c.HouseUnit,
            c.Street,
            c.Barangay,
            c.City,
            c.Province,
            c.ZipCode,
            FormatAddress(c.HouseUnit, c.Street, c.Barangay, c.City, c.Province, c.ZipCode),
            c.Mobile,
            c.Phone,
            c.Email,
            c.ReferredBy,
            c.DateOfBirth,
            c.IdType,
            c.IdNumber,
            c.CoMakerName,
            c.CoMakerMobile,
            c.CoMakerIdNumber,
            c.GuarantorName,
            c.GuarantorMobile,
            c.GuarantorIdNumber,
            c.Latitude,
            c.Longitude,
            c.CreatedAt,
            !string.IsNullOrWhiteSpace(c.ProfilePictureStoredFileName),
            c.Documents
                .OrderByDescending(d => d.UploadedAt)
                .Select(d => new CustomerDocumentDto(d.Id, d.Label, d.OriginalFileName, d.ContentType, d.SizeBytes, d.UploadedAt))
                .ToList());

    private static string FormatAddress(params string?[] parts) =>
        string.Join(", ", parts.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()));
}
