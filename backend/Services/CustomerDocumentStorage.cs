namespace MicroLending.Api.Services;

public class CustomerDocumentStorage
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
        ".pdf",
        ".doc", ".docx"
    };

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

    private readonly IWebHostEnvironment _env;

    public CustomerDocumentStorage(IWebHostEnvironment env) => _env = env;

    public string GetCustomerFolder(int customerId)
    {
        var root = Path.Combine(_env.ContentRootPath, "Uploads", "customers", customerId.ToString());
        Directory.CreateDirectory(root);
        return root;
    }

    public void ValidateFile(IFormFile file)
    {
        if (file.Length <= 0) throw new InvalidOperationException("Empty file.");
        if (file.Length > 15 * 1024 * 1024) throw new InvalidOperationException("File too large (max 15 MB).");

        var ext = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(ext))
            throw new InvalidOperationException("File type not allowed. Use image, PDF, or Word.");

        if (!string.IsNullOrWhiteSpace(file.ContentType) &&
            !AllowedContentTypes.Contains(file.ContentType) &&
            !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            // Some browsers send odd content types for docx; extension check is primary.
            if (!AllowedExtensions.Contains(ext))
                throw new InvalidOperationException("File content type not allowed.");
        }
    }

    public async Task<(string StoredFileName, string ContentType, long Size)> SaveAsync(int customerId, IFormFile file)
    {
        ValidateFile(file);
        var ext = Path.GetExtension(file.FileName);
        var stored = $"{Guid.NewGuid():N}{ext}";
        var path = Path.Combine(GetCustomerFolder(customerId), stored);
        await using var stream = File.Create(path);
        await file.CopyToAsync(stream);
        return (stored, string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType, file.Length);
    }

    public string GetPhysicalPath(int customerId, string storedFileName) =>
        Path.Combine(GetCustomerFolder(customerId), storedFileName);

    public void DeleteIfExists(int customerId, string storedFileName)
    {
        var path = GetPhysicalPath(customerId, storedFileName);
        if (File.Exists(path)) File.Delete(path);
    }

    public string GetLoanFieldNoteFolder(int loanId, int noteId)
    {
        var root = Path.Combine(_env.ContentRootPath, "Uploads", "loans", loanId.ToString(), "notes", noteId.ToString());
        Directory.CreateDirectory(root);
        return root;
    }

    public async Task<(string StoredFileName, string ContentType, long Size)> SaveLoanFieldNoteAsync(
        int loanId,
        int noteId,
        IFormFile file)
    {
        ValidateFile(file);
        var ext = Path.GetExtension(file.FileName);
        var stored = $"{Guid.NewGuid():N}{ext}";
        var path = Path.Combine(GetLoanFieldNoteFolder(loanId, noteId), stored);
        await using var stream = File.Create(path);
        await file.CopyToAsync(stream);
        return (stored, string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType, file.Length);
    }

    public string GetLoanFieldNotePhysicalPath(int loanId, int noteId, string storedFileName) =>
        Path.Combine(GetLoanFieldNoteFolder(loanId, noteId), storedFileName);
}
