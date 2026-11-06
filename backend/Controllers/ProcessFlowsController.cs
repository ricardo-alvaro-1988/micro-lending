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
        var query = _db.ProcessFlows.Include(f => f.Stages).AsQueryable();
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
        var flow = await _db.ProcessFlows.Include(f => f.Stages).FirstOrDefaultAsync(f => f.Id == id);
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
        var flow = await _db.ProcessFlows.Include(f => f.Stages).FirstOrDefaultAsync(f => f.Id == id);
        if (flow is null) return NotFound();

        if (request.Stages.Count == 0)
            return BadRequest(new { message = "At least one stage is required." });

        var hasLoans = await _db.Loans.AnyAsync(l => l.FlowId == id);
        var ordered = request.Stages.OrderBy(s => s.SortOrder).ThenBy(s => s.Name).ToList();
        NormalizeFinalStage(ordered);

        foreach (var stage in ordered.Where(s => s.RequiresApproval && !s.IsFinal))
        {
            if (string.IsNullOrWhiteSpace(stage.ApproverRoleId) && string.IsNullOrWhiteSpace(stage.ApproverUserId))
                return BadRequest(new { message = $"Stage '{stage.Name}' requires an approver role or user." });
        }

        if (hasLoans)
        {
            // Allow updating routes/approvers/names in place; do not add/remove stages.
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
                stage.ApproverRoleId = isLast || string.IsNullOrWhiteSpace(s.ApproverRoleId) ? null : s.ApproverRoleId;
                stage.ApproverUserId = isLast || string.IsNullOrWhiteSpace(s.ApproverUserId) ? null : s.ApproverUserId;
                stage.IsFinal = isLast;
            }

            await _db.SaveChangesAsync();
            ApplyRoutingBySortOrder(existing, ordered);
            flow.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(await MapFlowAsync(flow));
        }

        // Clear self-FKs before delete to avoid cycles
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
                ApproverRoleId = isLast || string.IsNullOrWhiteSpace(s.ApproverRoleId) ? null : s.ApproverRoleId,
                ApproverUserId = isLast || string.IsNullOrWhiteSpace(s.ApproverUserId) ? null : s.ApproverUserId,
                IsFinal = isLast
            };
            _db.ProcessStages.Add(stage);
            created.Add(stage);
        }

        await _db.SaveChangesAsync();
        ApplyRoutingBySortOrder(created, ordered);
        flow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        flow = await _db.ProcessFlows.Include(f => f.Stages).FirstAsync(f => f.Id == id);
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

    /// <summary>Every flow ends at Approved-Final (ready for payment schedule).</summary>
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
            ordered[i].OnApproveSortOrder = null;
            ordered[i].OnDeclineEndsLoan = true;
            ordered[i].OnDeclineSortOrder = null;
        }
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
                stage.OnApproveStageId = null; // next by default

            if (req.OnDeclineEndsLoan || req.OnDeclineSortOrder is null)
                stage.OnDeclineStageId = null; // rejected end
            else if (bySort.TryGetValue(req.OnDeclineSortOrder.Value, out var declineTarget))
                stage.OnDeclineStageId = declineTarget.Id;
            else
                stage.OnDeclineStageId = null;
        }
    }

    private async Task<ProcessFlowDto> MapFlowAsync(ProcessFlow flow)
    {
        await _db.Entry(flow).Collection(f => f.Stages).LoadAsync();
        var roleIds = flow.Stages.Where(s => s.ApproverRoleId != null).Select(s => s.ApproverRoleId!).Distinct().ToList();
        var userIds = flow.Stages.Where(s => s.ApproverUserId != null).Select(s => s.ApproverUserId!).Distinct().ToList();
        var roles = await _db.Roles.Where(r => roleIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Name!);
        var users = await _db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName);
        var stageMap = flow.Stages.ToDictionary(s => s.Id);

        var stages = flow.Stages.OrderBy(s => s.SortOrder).Select(s =>
        {
            ProcessStage? approve = s.OnApproveStageId is int aid && stageMap.TryGetValue(aid, out var a) ? a : null;
            ProcessStage? decline = s.OnDeclineStageId is int did && stageMap.TryGetValue(did, out var d) ? d : null;
            return new ProcessStageDto(
                s.Id,
                s.Name,
                s.SortOrder,
                s.RequiresApproval,
                s.ApproverRoleId,
                s.ApproverRoleId != null && roles.TryGetValue(s.ApproverRoleId, out var rn) ? rn : null,
                s.ApproverUserId,
                s.ApproverUserId != null && users.TryGetValue(s.ApproverUserId, out var un) ? un : null,
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
