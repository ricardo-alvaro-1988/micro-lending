using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/flows")]
[Authorize]
public class ProcessFlowsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProcessFlowsController(AppDbContext db) => _db = db;

    [HttpGet]
    [Authorize(Policy = $"perm:{PermissionCodes.FlowsView}")]
    public async Task<ActionResult<IEnumerable<ProcessFlowDto>>> GetAll([FromQuery] bool activeOnly = false)
    {
        var query = _db.ProcessFlows
            .Include(f => f.Stages).ThenInclude(s => s.ApproverRoles)
            .Include(f => f.Stages).ThenInclude(s => s.ApproverUsers)
            .AsQueryable();
        if (activeOnly) query = query.Where(f => f.IsActive);

        var flows = await query.OrderBy(f => f.Name).ToListAsync();
        var result = new List<ProcessFlowDto>();
        foreach (var flow in flows)
            result.Add(await MapFlowAsync(flow));
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.FlowsView}")]
    public async Task<ActionResult<ProcessFlowDto>> Get(int id)
    {
        var flow = await _db.ProcessFlows
            .Include(f => f.Stages).ThenInclude(s => s.ApproverRoles)
            .Include(f => f.Stages).ThenInclude(s => s.ApproverUsers)
            .FirstOrDefaultAsync(f => f.Id == id);
        if (flow is null) return NotFound();
        return Ok(await MapFlowAsync(flow));
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.FlowsManage}")]
    public async Task<ActionResult<ProcessFlowDto>> Create([FromBody] CreateProcessFlowRequest request)
    {
        var flow = new ProcessFlow
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsActive = request.IsActive
        };
        _db.ProcessFlows.Add(flow);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = flow.Id }, await MapFlowAsync(flow));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.FlowsManage}")]
    public async Task<ActionResult<ProcessFlowDto>> Update(int id, [FromBody] UpdateProcessFlowRequest request)
    {
        var flow = await _db.ProcessFlows.Include(f => f.Stages).FirstOrDefaultAsync(f => f.Id == id);
        if (flow is null) return NotFound();

        flow.Name = request.Name.Trim();
        flow.Description = request.Description?.Trim();
        flow.IsActive = request.IsActive;
        flow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await MapFlowAsync(flow));
    }

    [HttpPut("{id:int}/stages")]
    [Authorize(Policy = $"perm:{PermissionCodes.FlowsManage}")]
    public async Task<ActionResult<ProcessFlowDto>> ReplaceStages(int id, [FromBody] ReplaceStagesRequest request)
    {
        var flow = await _db.ProcessFlows
            .Include(f => f.Stages).ThenInclude(s => s.ApproverRoles)
            .Include(f => f.Stages).ThenInclude(s => s.ApproverUsers)
            .FirstOrDefaultAsync(f => f.Id == id);
        if (flow is null) return NotFound();

        if (request.Stages.Count == 0)
            return BadRequest(new { message = "At least one stage is required." });

        var hasLoans = await _db.Loans.AnyAsync(l => l.FlowId == id);
        var ordered = request.Stages.OrderBy(s => s.SortOrder).ThenBy(s => s.Name).ToList();
        NormalizeFinalStage(ordered);

        foreach (var stage in ordered.Where(s => s.RequiresApproval && !s.IsFinal))
        {
            var roleIds = ResolveRoleIds(stage);
            var userIds = ResolveUserIds(stage);
            if (roleIds.Count == 0 && userIds.Count == 0)
                return BadRequest(new { message = $"Stage '{stage.Name}' requires at least one approver role or user." });
        }

        var validationError = await ValidateApproversAsync(ordered);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        if (hasLoans)
        {
            if (ordered.Count != flow.Stages.Count)
                return BadRequest(new { message = "Cannot add/remove stages while loans use this flow. You can still edit approve/decline routing." });

            var existing = flow.Stages.OrderBy(s => s.SortOrder).ToList();
            for (var i = 0; i < existing.Count; i++)
            {
                var s = ordered[i];
                var stage = existing[i];
                var isLast = i == existing.Count - 1;
                stage.Name = isLast ? "Approved-Final" : s.Name.Trim();
                stage.RequiresApproval = isLast ? false : s.RequiresApproval;
                stage.IsFinal = isLast;
                stage.ApproverRoleId = null;
                stage.ApproverUserId = null;
                ReplaceStageApprovers(stage, isLast ? [] : ResolveRoleIds(s), isLast ? [] : ResolveUserIds(s));
            }

            await _db.SaveChangesAsync();
            ApplyRoutingBySortOrder(existing, ordered);
            flow.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(await MapFlowAsync(flow));
        }

        foreach (var stage in flow.Stages)
        {
            stage.OnApproveStageId = null;
            stage.OnDeclineStageId = null;
        }
        await _db.SaveChangesAsync();

        _db.ProcessStages.RemoveRange(flow.Stages);
        await _db.SaveChangesAsync();

        var created = new List<ProcessStage>();
        for (var i = 0; i < ordered.Count; i++)
        {
            var s = ordered[i];
            var isLast = i == ordered.Count - 1;
            var stage = new ProcessStage
            {
                FlowId = id,
                Name = isLast ? "Approved-Final" : s.Name.Trim(),
                SortOrder = i + 1,
                RequiresApproval = isLast ? false : s.RequiresApproval,
                ApproverRoleId = null,
                ApproverUserId = null,
                IsFinal = isLast
            };
            ReplaceStageApprovers(stage, isLast ? [] : ResolveRoleIds(s), isLast ? [] : ResolveUserIds(s));
            _db.ProcessStages.Add(stage);
            created.Add(stage);
        }

        await _db.SaveChangesAsync();
        ApplyRoutingBySortOrder(created, ordered);
        flow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        flow = await _db.ProcessFlows
            .Include(f => f.Stages).ThenInclude(s => s.ApproverRoles)
            .Include(f => f.Stages).ThenInclude(s => s.ApproverUsers)
            .FirstAsync(f => f.Id == id);
        return Ok(await MapFlowAsync(flow));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.FlowsManage}")]
    public async Task<IActionResult> Delete(int id)
    {
        var flow = await _db.ProcessFlows.Include(f => f.Stages).FirstOrDefaultAsync(f => f.Id == id);
        if (flow is null) return NotFound();

        if (await _db.Loans.AnyAsync(l => l.FlowId == id))
            return BadRequest(new { message = "Flow is used by loans. Deactivate it instead." });

        foreach (var stage in flow.Stages)
        {
            stage.OnApproveStageId = null;
            stage.OnDeclineStageId = null;
        }
        await _db.SaveChangesAsync();

        _db.ProcessFlows.Remove(flow);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static void NormalizeFinalStage(List<UpsertStageRequest> ordered)
    {
        for (var i = 0; i < ordered.Count; i++)
        {
            var isLast = i == ordered.Count - 1;
            ordered[i].IsFinal = isLast;
            if (!isLast) continue;
            ordered[i].Name = "Approved-Final";
            ordered[i].RequiresApproval = false;
            ordered[i].ApproverRoleId = null;
            ordered[i].ApproverUserId = null;
            ordered[i].ApproverRoleIds = [];
            ordered[i].ApproverUserIds = [];
            ordered[i].OnApproveSortOrder = null;
            ordered[i].OnDeclineEndsLoan = true;
            ordered[i].OnDeclineSortOrder = null;
        }
    }

    private static List<string> ResolveRoleIds(UpsertStageRequest stage)
    {
        var ids = (stage.ApproverRoleIds ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (ids.Count == 0 && !string.IsNullOrWhiteSpace(stage.ApproverRoleId))
            ids.Add(stage.ApproverRoleId.Trim());
        return ids;
    }

    private static List<string> ResolveUserIds(UpsertStageRequest stage)
    {
        var ids = (stage.ApproverUserIds ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (ids.Count == 0 && !string.IsNullOrWhiteSpace(stage.ApproverUserId))
            ids.Add(stage.ApproverUserId.Trim());
        return ids;
    }

    private async Task<string?> ValidateApproversAsync(List<UpsertStageRequest> ordered)
    {
        var allRoleIds = ordered.SelectMany(ResolveRoleIds).Distinct().ToList();
        var allUserIds = ordered.SelectMany(ResolveUserIds).Distinct().ToList();

        if (allRoleIds.Count > 0)
        {
            var existingRoles = await _db.Roles.AsNoTracking()
                .Where(r => allRoleIds.Contains(r.Id))
                .Select(r => r.Id)
                .ToListAsync();
            var missing = allRoleIds.Except(existingRoles).ToList();
            if (missing.Count > 0)
                return "One or more approver roles were not found.";
        }

        if (allUserIds.Count > 0)
        {
            var existingUsers = await _db.Users.AsNoTracking()
                .Where(u => allUserIds.Contains(u.Id) && !u.IsDeleted)
                .Select(u => u.Id)
                .ToListAsync();
            var missing = allUserIds.Except(existingUsers).ToList();
            if (missing.Count > 0)
                return "One or more approver users were not found.";
        }

        return null;
    }

    private void ReplaceStageApprovers(ProcessStage stage, List<string> roleIds, List<string> userIds)
    {
        if (stage.ApproverRoles.Count > 0)
            _db.ProcessStageApproverRoles.RemoveRange(stage.ApproverRoles);
        stage.ApproverRoles.Clear();
        foreach (var roleId in roleIds)
            stage.ApproverRoles.Add(new ProcessStageApproverRole { RoleId = roleId });

        if (stage.ApproverUsers.Count > 0)
            _db.ProcessStageApproverUsers.RemoveRange(stage.ApproverUsers);
        stage.ApproverUsers.Clear();
        foreach (var userId in userIds)
            stage.ApproverUsers.Add(new ProcessStageApproverUser { UserId = userId });
    }

    private static void ApplyRoutingBySortOrder(List<ProcessStage> stages, List<UpsertStageRequest> requests)
    {
        var bySort = stages.ToDictionary(s => s.SortOrder);
        for (var i = 0; i < stages.Count; i++)
        {
            var stage = stages[i];
            var req = requests[i];

            if (req.OnApproveSortOrder is int approveSort && bySort.TryGetValue(approveSort, out var approveTarget))
                stage.OnApproveStageId = approveTarget.Id;
            else
                stage.OnApproveStageId = null;

            if (req.OnDeclineEndsLoan || req.OnDeclineSortOrder is null)
                stage.OnDeclineStageId = null;
            else if (bySort.TryGetValue(req.OnDeclineSortOrder.Value, out var declineTarget))
                stage.OnDeclineStageId = declineTarget.Id;
            else
                stage.OnDeclineStageId = null;
        }
    }

    private async Task<ProcessFlowDto> MapFlowAsync(ProcessFlow flow)
    {
        await _db.Entry(flow).Collection(f => f.Stages).LoadAsync();
        foreach (var stage in flow.Stages)
        {
            await _db.Entry(stage).Collection(s => s.ApproverRoles).LoadAsync();
            await _db.Entry(stage).Collection(s => s.ApproverUsers).LoadAsync();
        }

        var roleIds = flow.Stages
            .SelectMany(s =>
            {
                var ids = s.ApproverRoles.Select(r => r.RoleId).ToList();
                if (ids.Count == 0 && s.ApproverRoleId is not null) ids.Add(s.ApproverRoleId);
                return ids;
            })
            .Distinct()
            .ToList();
        var userIds = flow.Stages
            .SelectMany(s =>
            {
                var ids = s.ApproverUsers.Select(u => u.UserId).ToList();
                if (ids.Count == 0 && s.ApproverUserId is not null) ids.Add(s.ApproverUserId);
                return ids;
            })
            .Distinct()
            .ToList();

        var roles = await _db.Roles.Where(r => roleIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Name!);
        var users = await _db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName);
        var stageMap = flow.Stages.ToDictionary(s => s.Id);

        var stages = flow.Stages.OrderBy(s => s.SortOrder).Select(s =>
        {
            ProcessStage? approve = s.OnApproveStageId is int aid && stageMap.TryGetValue(aid, out var a) ? a : null;
            ProcessStage? decline = s.OnDeclineStageId is int did && stageMap.TryGetValue(did, out var d) ? d : null;

            var stageRoleIds = s.ApproverRoles.Select(r => r.RoleId).ToList();
            if (stageRoleIds.Count == 0 && s.ApproverRoleId is not null)
                stageRoleIds.Add(s.ApproverRoleId);
            var stageUserIds = s.ApproverUsers.Select(u => u.UserId).ToList();
            if (stageUserIds.Count == 0 && s.ApproverUserId is not null)
                stageUserIds.Add(s.ApproverUserId);

            var roleDtos = stageRoleIds
                .Where(id => roles.ContainsKey(id))
                .Select(id => new ProcessStageApproverRoleDto(id, roles[id]))
                .ToList();
            var userDtos = stageUserIds
                .Where(id => users.ContainsKey(id))
                .Select(id => new ProcessStageApproverUserDto(id, users[id]))
                .ToList();

            return new ProcessStageDto(
                s.Id,
                s.Name,
                s.SortOrder,
                s.RequiresApproval,
                roleDtos.FirstOrDefault()?.RoleId,
                roleDtos.FirstOrDefault()?.RoleName,
                userDtos.FirstOrDefault()?.UserId,
                userDtos.FirstOrDefault()?.UserName,
                roleDtos,
                userDtos,
                s.IsFinal,
                s.OnApproveStageId,
                approve?.SortOrder,
                approve?.Name,
                s.OnDeclineStageId,
                decline?.SortOrder,
                decline?.Name,
                s.OnDeclineStageId is null);
        }).ToList();

        return new ProcessFlowDto(flow.Id, flow.Name, flow.Description, flow.IsActive, stages);
    }
}
