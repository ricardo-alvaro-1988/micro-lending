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
[Route("api/customers/{customerId:int}/loans/{loanId:int}/field-notes")]
[Authorize]
public class LoanFieldNotesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly BranchScopeService _branchScope;
    private readonly CustomerDocumentStorage _storage;

    public LoanFieldNotesController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        BranchScopeService branchScope,
        CustomerDocumentStorage storage)
    {
        _db = db;
        _userManager = userManager;
        _branchScope = branchScope;
        _storage = storage;
    }

    private async Task<(ActionResult? Error, Customer? Customer, Loan? Loan)> LoadAccessAsync(int customerId, int loanId)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return (Unauthorized(), null, null);

        var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == customerId);
        if (customer is null) return (NotFound(), null, null);
        if (!BranchScopeService.CanAccessCustomer(scope, customer)) return (NotFound(), null, null);

        var loan = await _db.Loans.FirstOrDefaultAsync(l => l.Id == loanId && l.CustomerId == customerId);
        if (loan is null) return (NotFound(), null, null);
        return (null, customer, loan);
    }

    private static LoanFieldNoteDto MapNote(LoanFieldNote note, int customerId) =>
        new(
            note.Id,
            note.LoanId,
            note.Body,
            note.CreatedByUser?.FullName ?? "—",
            note.CreatedByUserId,
            note.CreatedAt,
            note.Attachments
                .OrderBy(a => a.UploadedAt)
                .Select(a => new LoanFieldNoteAttachmentDto(
                    a.Id,
                    a.OriginalFileName,
                    a.ContentType,
                    a.SizeBytes,
                    a.UploadedAt,
                    $"/api/customers/{customerId}/loans/{note.LoanId}/field-notes/{note.Id}/attachments/{a.Id}/file"))
                .ToList());

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanFieldNoteDto>>> List(int customerId, int loanId)
    {
        if (!PermissionChecks.CanReviewLoanApplication(User)) return Forbid();

        var (error, _, _) = await LoadAccessAsync(customerId, loanId);
        if (error is not null) return error;

        var notes = await _db.LoanFieldNotes.AsNoTracking()
            .Include(n => n.CreatedByUser)
            .Include(n => n.Attachments)
            .Where(n => n.LoanId == loanId)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        return Ok(notes.Select(n => MapNote(n, customerId)));
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.FieldNotes}")]
    public async Task<ActionResult<LoanFieldNoteDto>> Create(
        int customerId,
        int loanId,
        [FromBody] CreateLoanFieldNoteRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var (error, _, loan) = await LoadAccessAsync(customerId, loanId);
        if (error is not null) return error;
        if (loan is null) return NotFound();

        var body = (request.Body ?? string.Empty).Trim();
        if (body.Length == 0) return BadRequest(new { message = "Note text is required." });

        var note = new LoanFieldNote
        {
            LoanId = loan.Id,
            Body = body,
            CreatedByUserId = user.Id,
            CreatedAt = DateTime.UtcNow,
        };
        _db.LoanFieldNotes.Add(note);
        await _db.SaveChangesAsync();

        note.CreatedByUser = user;
        return Ok(MapNote(note, customerId));
    }

    [HttpPost("{noteId:int}/attachments")]
    [Authorize(Policy = $"perm:{PermissionCodes.FieldNotes}")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<LoanFieldNoteAttachmentDto>> UploadAttachment(
        int customerId,
        int loanId,
        int noteId,
        [FromForm] IFormFile? file)
    {
        var (error, _, _) = await LoadAccessAsync(customerId, loanId);
        if (error is not null) return error;

        var note = await _db.LoanFieldNotes
            .Include(n => n.Attachments)
            .FirstOrDefaultAsync(n => n.Id == noteId && n.LoanId == loanId);
        if (note is null) return NotFound();
        if (file is null || file.Length <= 0) return BadRequest(new { message = "File is required." });

        try
        {
            var saved = await _storage.SaveLoanFieldNoteAsync(loanId, noteId, file);
            var att = new LoanFieldNoteAttachment
            {
                NoteId = noteId,
                OriginalFileName = Path.GetFileName(file.FileName),
                StoredFileName = saved.StoredFileName,
                ContentType = saved.ContentType,
                SizeBytes = saved.Size,
                UploadedAt = DateTime.UtcNow,
            };
            _db.LoanFieldNoteAttachments.Add(att);
            await _db.SaveChangesAsync();

            return Ok(new LoanFieldNoteAttachmentDto(
                att.Id,
                att.OriginalFileName,
                att.ContentType,
                att.SizeBytes,
                att.UploadedAt,
                $"/api/customers/{customerId}/loans/{loanId}/field-notes/{noteId}/attachments/{att.Id}/file"));
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

    [HttpGet("{noteId:int}/attachments/{attachmentId:int}/file")]
    public async Task<IActionResult> DownloadAttachment(int customerId, int loanId, int noteId, int attachmentId)
    {
        if (!PermissionChecks.CanReviewLoanApplication(User)) return Forbid();

        var (error, _, _) = await LoadAccessAsync(customerId, loanId);
        if (error is not null) return error;

        var att = await _db.LoanFieldNoteAttachments
            .AsNoTracking()
            .Include(a => a.Note)
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.NoteId == noteId && a.Note.LoanId == loanId);
        if (att is null) return NotFound();

        var path = _storage.GetLoanFieldNotePhysicalPath(loanId, noteId, att.StoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound(new { message = "File missing on disk." });
        return PhysicalFile(path, att.ContentType, att.OriginalFileName);
    }
}
