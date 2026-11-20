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
[Route("api/payments/group-day")]
[Authorize]
public class GroupPaymentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly LoanFinanceService _finance;
    private readonly BranchScopeService _branchScope;

    public GroupPaymentsController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        LoanFinanceService finance,
        BranchScopeService branchScope)
    {
        _db = db;
        _userManager = userManager;
        _finance = finance;
        _branchScope = branchScope;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GroupDayPaymentRowDto>>> List(
        [FromQuery] int groupId,
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null)
    {
        var canOffice = User.HasClaim("permission", PermissionCodes.LoansManage);
        var canField = User.HasClaim("permission", PermissionCodes.FieldCollect);
        if (!canOffice && !canField) return Forbid();
        if (groupId <= 0) return BadRequest(new { message = "groupId is required." });

        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        // "Due as of" controls which installments are listed; late fees / overdue use PH today only.
        var day = (asOf ?? PhilippineTime.Today).Date;
        var today = PhilippineTime.Today;
        await _finance.AccrueOpenItemsAsync(today);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope)
            .Where(c => c.GroupId == groupId);

        var raw = await (
            from item in _db.LoanScheduleItems.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where item.DueDate < day.AddDays(1)
                  && (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
            select new
            {
                item.Id,
                CustomerId = customer.Id,
                customer.FullName,
                customer.Mobile,
                LoanId = loan.Id,
                loan.LoanNumber,
                item.InstallmentNumber,
                item.DueDate,
                item.AmountDue,
                item.PenaltyAmount,
                item.PaidAmount,
                item.Status,
                loan.PrimarySavingsBalance,
                loan.ExtraSavingsBalance,
            }
        )
            .OrderBy(x => x.DueDate)
            .ThenBy(x => x.FullName)
            .ThenBy(x => x.InstallmentNumber)
            .ToListAsync();

        var rows = raw.Select(x =>
        {
            var remaining = Math.Max(0, x.AmountDue + x.PenaltyAmount - x.PaidAmount);
            var open = remaining > 0.009m;
            return new GroupDayPaymentRowDto(
                x.Id,
                x.CustomerId,
                x.FullName,
                x.Mobile,
                x.LoanId,
                x.LoanNumber,
                x.InstallmentNumber,
                x.DueDate,
                x.AmountDue,
                x.PenaltyAmount,
                x.PaidAmount,
                remaining,
                x.Status.ToString(),
                // Overdue vs Philippine today — not the filter date (avoids future "overdue").
                open && x.DueDate.Date < today,
                x.PrimarySavingsBalance,
                x.ExtraSavingsBalance,
                !open);
        }).ToList();

        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<object>> RecordBatch([FromBody] GroupDayPaymentBatchRequest request)
    {
        var canOffice = User.HasClaim("permission", PermissionCodes.LoansManage);
        var canField = User.HasClaim("permission", PermissionCodes.FieldCollect);
        if (!canOffice && !canField) return Forbid();

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        if (request.GroupId <= 0)
            return BadRequest(new { message = "groupId is required." });
        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { message = "Select at least one payment." });

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var groupExists = await _db.CustomerGroups.AsNoTracking().AnyAsync(g => g.Id == request.GroupId);
        if (!groupExists) return BadRequest(new { message = "Group not found." });

        var paidAt = PhilippineTime.Normalize(request.PaidAt);
        var method = string.IsNullOrWhiteSpace(request.Method) ? "Cash" : request.Method.Trim();

        // Aggregate by loan so one payment posts per loan.
        var groups = request.Items
            .GroupBy(i => new { i.CustomerId, i.LoanId })
            .Select(g => new
            {
                g.Key.CustomerId,
                g.Key.LoanId,
                Amount = g.Sum(x => x.Amount),
                UseExtraSavings = g.Any(x => x.UseExtraSavings),
                ScheduleItemIds = g.Where(x => x.ScheduleItemId is int).Select(x => x.ScheduleItemId!.Value).ToList(),
            })
            .ToList();

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var recorded = 0;
            foreach (var item in groups)
            {
                var customer = await _db.Customers.AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == item.CustomerId);
                if (customer is null || customer.GroupId != request.GroupId)
                    throw new InvalidOperationException($"Customer {item.CustomerId} is not in the selected group.");
                if (!BranchScopeService.CanAccessCustomer(scope, customer))
                    throw new InvalidOperationException($"Customer {item.CustomerId} is outside your branch scope.");

                var loan = await _finance.LoadLoanFinanceAsync(item.LoanId);
                if (loan is null || loan.CustomerId != item.CustomerId)
                    throw new InvalidOperationException($"Loan {item.LoanId} was not found for the customer.");
                if (!loan.ScheduleItems.Any())
                    throw new InvalidOperationException($"Loan {loan.LoanNumber} has no payment schedule.");

                decimal coverTarget;
                if (item.ScheduleItemIds.Count > 0)
                {
                    coverTarget = loan.ScheduleItems
                        .Where(s => item.ScheduleItemIds.Contains(s.Id))
                        .Sum(LoanFinanceService.ItemBalance);
                }
                else
                {
                    coverTarget = loan.ScheduleItems.Sum(LoanFinanceService.ItemBalance);
                }

                if (coverTarget <= 0.009m)
                    continue;

                var cash = decimal.Round(item.Amount, 2);
                if (cash < 0) throw new InvalidOperationException("Payment amount cannot be negative.");

                var payment = new LoanPayment
                {
                    Amount = cash,
                    PaidAt = paidAt,
                    Method = method,
                    Notes = "Group day collection",
                    RecordedByUserId = user.Id,
                    CreatedAt = PhilippineTime.Now,
                };
                loan.Payments.Add(payment);

                var (_, extraOffset, _) = await _finance.ApplyPaymentAsync(
                    loan,
                    cash,
                    item.UseExtraSavings,
                    user.Id,
                    payment,
                    coverTarget);

                if (extraOffset > 0)
                    payment.Notes =
                        $"Group day collection; Extra savings offset {extraOffset:0.00}; full applied {payment.Amount:0.00}";

                loan.UpdatedAt = PhilippineTime.Now;
                _finance.TryMatureIfFullyPaid(loan, user);
                recorded++;
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(new { recorded, message = $"{recorded} payment(s) recorded." });
        }
        catch (InvalidOperationException ex)
        {
            await tx.RollbackAsync();
            return BadRequest(new { message = ex.Message });
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
