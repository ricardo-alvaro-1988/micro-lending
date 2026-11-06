namespace MicroLending.Api.Models;

public class LoanFieldNote
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public string Body { get; set; } = string.Empty;
    public string CreatedByUserId { get; set; } = string.Empty;
    public ApplicationUser CreatedByUser { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<LoanFieldNoteAttachment> Attachments { get; set; } = new List<LoanFieldNoteAttachment>();
}

public class LoanFieldNoteAttachment
{
    public int Id { get; set; }
    public int NoteId { get; set; }
    public LoanFieldNote Note { get; set; } = null!;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
