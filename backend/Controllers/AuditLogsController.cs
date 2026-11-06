using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Policy = $"perm:{PermissionCodes.AuditView}")]
public class AuditLogsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditLogsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuditLogDto>>> GetAll(
        [FromQuery] string? entityType = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var query = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            var type = entityType.Trim();
            query = query.Where(a => a.EntityType == type);
        }

        if (from is DateTime fromDt)
        {
            var fromUtc = DateTime.SpecifyKind(fromDt.Date, DateTimeKind.Utc);
            query = query.Where(a => a.OccurredAt >= fromUtc);
        }

        if (to is DateTime toDt)
        {
            var toExclusive = DateTime.SpecifyKind(toDt.Date.AddDays(1), DateTimeKind.Utc);
            query = query.Where(a => a.OccurredAt < toExclusive);
        }

        var rows = await query
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Id)
            .Take(200)
            .Select(a => new AuditLogDto(
                a.Id,
                a.OccurredAt,
                a.ActorUserId,
                a.ActorUserName,
                a.Action,
                a.EntityType,
                a.EntityId,
                a.Summary,
                a.DetailsJson))
            .ToListAsync();

        return Ok(rows);
    }
}
