using System.Security.Claims;
using System.Text.Json;
using MicroLending.Api.Data;
using MicroLending.Api.Models;

namespace MicroLending.Api.Services;

public class AuditService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;

    public AuditService(AppDbContext db, IHttpContextAccessor http)
    {
        _db = db;
        _http = http;
    }

    public async Task LogAsync(
        string action,
        string entityType,
        string? entityId,
        string summary,
        object? details = null)
    {
        var user = _http.HttpContext?.User;
        var actorId = user?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user?.FindFirstValue("sub");
        var actorName = user?.FindFirstValue("fullName")
            ?? user?.FindFirstValue(ClaimTypes.Name)
            ?? user?.Identity?.Name
            ?? "System";

        string? detailsJson = null;
        if (details is not null)
        {
            detailsJson = details is string s
                ? s
                : JsonSerializer.Serialize(details, JsonOptions);
        }

        _db.AuditLogs.Add(new AuditLog
        {
            OccurredAt = DateTime.UtcNow,
            ActorUserId = actorId,
            ActorUserName = actorName,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Summary = summary,
            DetailsJson = detailsJson,
        });
        await _db.SaveChangesAsync();
    }
}
