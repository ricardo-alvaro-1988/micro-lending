namespace MicroLending.Api.Models;

/// <summary>Immutable system change trail (roles, users, settings, remittances, etc.).</summary>
public class AuditLog
{
    public long Id { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public string? ActorUserId { get; set; }
    public string ActorUserName { get; set; } = string.Empty;
    /// <summary>Created / Updated / Deleted / Submitted / Received, etc.</summary>
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string? DetailsJson { get; set; }
}
