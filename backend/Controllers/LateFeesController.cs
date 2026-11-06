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
[Route("api/late-fees")]
[Authorize]
public class LateFeesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LoanFinanceService _finance;
    private readonly AuditService _audit;

    public LateFeesController(AppDbContext db, LoanFinanceService finance, AuditService audit)
    {
        _db = db;
        _finance = finance;
        _audit = audit;
    }

    [HttpGet("settings")]
    [Authorize(Policy = $"perm:{PermissionCodes.LateFeesSettings}")]
    public async Task<ActionResult<LateFeeSettingsDto>> GetSettings()
    {
        var row = await EnsureRowAsync();
        return Ok(Map(row));
    }

    [HttpPut("settings")]
    [Authorize(Policy = $"perm:{PermissionCodes.LateFeesSettings}")]
    public async Task<ActionResult<LateFeeSettingsDto>> UpdateSettings([FromBody] UpdateLateFeeSettingsRequest request)
    {
        if (!Enum.TryParse<LateFeeType>(request.Type, ignoreCase: true, out var type))
            return BadRequest(new { message = "Type must be FlatOnce, FlatPerDay, or PercentOfInstallmentPerDay." });

        var row = await EnsureRowAsync();
        row.IsEnabled = request.IsEnabled;
        row.Type = type;
        row.Amount = decimal.Round(request.Amount, 2);
        row.Percent = decimal.Round(request.Percent, 4);
        row.GraceDays = request.GraceDays;
        row.MaxPerInstallment = request.MaxPerInstallment is null or <= 0
            ? null
            : decimal.Round(request.MaxPerInstallment.Value, 2);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        _finance.InvalidateLateFeeCache();

        await _audit.LogAsync(
            "Updated",
            "LateFeeSettings",
            "1",
            $"Updated late fee settings (enabled={row.IsEnabled}, type={row.Type})",
            new
            {
                row.IsEnabled,
                Type = row.Type.ToString(),
                row.Amount,
                row.Percent,
                row.GraceDays,
                row.MaxPerInstallment,
            });

        return Ok(Map(row));
    }

    private async Task<LateFeeSettings> EnsureRowAsync()
    {
        var row = await _db.LateFeeSettings.FirstOrDefaultAsync(s => s.Id == 1);
        if (row is not null) return row;

        row = new LateFeeSettings
        {
            Id = 1,
            IsEnabled = false,
            Type = LateFeeType.FlatPerDay,
            Amount = 10,
            Percent = 1,
            GraceDays = 0,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.LateFeeSettings.Add(row);
        await _db.SaveChangesAsync();
        return row;
    }

    private static LateFeeSettingsDto Map(LateFeeSettings s) =>
        new(s.IsEnabled, s.Type.ToString(), s.Amount, s.Percent, s.GraceDays, s.MaxPerInstallment, s.UpdatedAt);
}
