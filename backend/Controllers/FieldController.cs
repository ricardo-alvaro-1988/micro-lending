using MicroLending.Api.Auth;
using MicroLending.Api.Data;
using MicroLending.Api.Dtos;
using MicroLending.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Controllers;

[ApiController]
[Route("api/field")]
[Authorize]
public class FieldController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BranchScopeService _branchScope;
    private readonly LoanFinanceService _finance;

    public FieldController(AppDbContext db, BranchScopeService branchScope, LoanFinanceService finance)
    {
        _db = db;
        _branchScope = branchScope;
        _finance = finance;
    }

    /// <summary>Due / overdue installments for Agent-1 customers of the current field agent.</summary>
    [HttpGet("due-payments")]
    [Authorize(Policy = $"perm:{PermissionCodes.FieldCollect}")]
    public async Task<ActionResult<IEnumerable<FieldDuePaymentDto>>> DuePayments([FromQuery] DateTime? asOf = null)
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var day = (asOf ?? DateTime.UtcNow).Date;
        await _finance.AccrueOpenItemsAsync(day);

        var query =
            from item in _db.LoanScheduleItems.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
            join customer in _db.Customers.AsNoTracking() on loan.CustomerId equals customer.Id
            where customer.Agent1UserId == scope.UserId
                  && item.DueDate < day.AddDays(1)
                  && item.PaidAmount < item.AmountDue + item.PenaltyAmount
            select new { item, loan, customer };

        if (scope.EffectiveBranchId is int branchId)
            query = query.Where(x => x.customer.BranchId == branchId);

        var rows = await query
            .OrderBy(x => x.item.DueDate)
            .ThenBy(x => x.customer.FullName)
            .ThenBy(x => x.item.InstallmentNumber)
            .Select(x => new FieldDuePaymentDto(
                x.item.Id,
                x.customer.Id,
                x.customer.FullName,
                x.customer.Mobile,
                x.loan.Id,
                x.loan.LoanNumber,
                x.item.InstallmentNumber,
                x.item.DueDate,
                x.item.AmountDue,
                x.item.PenaltyAmount,
                x.item.PaidAmount,
                x.item.AmountDue + x.item.PenaltyAmount - x.item.PaidAmount,
                x.item.DueDate < day,
                x.loan.Status.ToString()))
            .ToListAsync();

        return Ok(rows);
    }
}
