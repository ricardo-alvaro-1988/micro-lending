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
[Route("api/dashboard")]
[Authorize(Policy = $"perm:{PermissionCodes.DashboardView}")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BranchScopeService _branchScope;
    private readonly LoanFinanceService _finance;

    public DashboardController(AppDbContext db, BranchScopeService branchScope, LoanFinanceService finance)
    {
        _db = db;
        _branchScope = branchScope;
        _finance = finance;
    }

    /// <summary>Office KPI snapshot: due vs collected today, overdue, cash today.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardKpiDto>> Summary(
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var day = (asOf ?? DateTime.UtcNow).Date;
        var next = day.AddDays(1);

        await _finance.AccrueOpenItemsAsync(day);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        var customerIds = await customers.Select(c => c.Id).ToListAsync();

        if (customerIds.Count == 0)
        {
            return Ok(new DashboardKpiDto(
                day, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
        }

        var scheduleOpen = await (
            from item in _db.LoanScheduleItems.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
            where customerIds.Contains(loan.CustomerId)
                  && item.PaidAmount < item.AmountDue + item.PenaltyAmount
                  && (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
            select new
            {
                item.DueDate,
                Remaining = item.AmountDue + item.PenaltyAmount - item.PaidAmount,
                loan.Id
            }).ToListAsync();

        var dueTodayRows = scheduleOpen.Where(x => x.DueDate.Date == day).ToList();
        var overdueRows = scheduleOpen.Where(x => x.DueDate.Date < day).ToList();

        var dueToday = dueTodayRows.Sum(x => x.Remaining);
        var dueTodayCount = dueTodayRows.Count;
        var overdueTotal = overdueRows.Sum(x => x.Remaining);
        var overdueCount = overdueRows.Count;
        var overdueLoanCount = overdueRows.Select(x => x.Id).Distinct().Count();

        var paymentsToday = await (
            from pay in _db.LoanPayments.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on pay.LoanId equals loan.Id
            where customerIds.Contains(loan.CustomerId)
                  && pay.PaidAt >= day
                  && pay.PaidAt < next
            select new { pay.Amount, pay.Method }
        ).ToListAsync();

        var collectedToday = paymentsToday.Sum(p => p.Amount);
        var collectedTodayCount = paymentsToday.Count;
        var cashTodayRows = paymentsToday
            .Where(p => string.Equals((p.Method ?? "").Trim(), "Cash", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var cashToday = cashTodayRows.Sum(p => p.Amount);
        var cashTodayCount = cashTodayRows.Count;
        var nonCashToday = collectedToday - cashToday;

        var variance = collectedToday - dueToday;
        var rate = dueToday <= 0
            ? (collectedToday > 0 ? 100m : 0m)
            : Math.Round(collectedToday / dueToday * 100m, 1, MidpointRounding.AwayFromZero);

        var activeLoans = await (
            from loan in _db.Loans.AsNoTracking()
            where customerIds.Contains(loan.CustomerId) && loan.Status == LoanStatus.ApprovedFinal
            select new { loan.Id, loan.TotalPayable }
        ).ToListAsync();

        var activeIds = activeLoans.Select(l => l.Id).ToList();
        var paidMap = activeIds.Count == 0
            ? new Dictionary<int, decimal>()
            : await _db.LoanPayments.AsNoTracking()
                .Where(p => activeIds.Contains(p.LoanId))
                .GroupBy(p => p.LoanId)
                .Select(g => new { LoanId = g.Key, Paid = g.Sum(x => x.Amount) })
                .ToDictionaryAsync(x => x.LoanId, x => x.Paid);

        var outstanding = activeLoans.Sum(l =>
        {
            var paid = paidMap.GetValueOrDefault(l.Id);
            var rem = l.TotalPayable - paid;
            return rem < 0 ? 0 : rem;
        });

        return Ok(new DashboardKpiDto(
            day,
            dueToday,
            dueTodayCount,
            collectedToday,
            collectedTodayCount,
            variance,
            rate,
            overdueTotal,
            overdueCount,
            overdueLoanCount,
            cashToday,
            cashTodayCount,
            nonCashToday,
            activeLoans.Count,
            outstanding));
    }

    /// <summary>Daily due vs collected series for the dashboard chart (default last 14 days).</summary>
    [HttpGet("collections-trend")]
    public async Task<ActionResult<DashboardTrendDto>> CollectionsTrend(
        [FromQuery] int days = 14,
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        days = Math.Clamp(days, 7, 90);
        var toDate = (asOf ?? DateTime.UtcNow).Date;
        var fromDate = toDate.AddDays(1 - days);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        var customerIds = await customers.Select(c => c.Id).ToListAsync();

        var dueByDay = new Dictionary<DateTime, decimal>();
        var collectedByDay = new Dictionary<DateTime, decimal>();
        var cashByDay = new Dictionary<DateTime, decimal>();

        if (customerIds.Count > 0)
        {
            var scheduleDue = await (
                from item in _db.LoanScheduleItems.AsNoTracking()
                join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
                where customerIds.Contains(loan.CustomerId)
                      && item.DueDate >= fromDate
                      && item.DueDate < toDate.AddDays(1)
                      && (loan.Status == LoanStatus.ApprovedFinal
                          || loan.Status == LoanStatus.Closed
                          || loan.Status == LoanStatus.InProgress
                          || loan.Status == LoanStatus.PendingApproval)
                select new { item.DueDate, item.AmountDue, item.PenaltyAmount }
            ).ToListAsync();

            foreach (var row in scheduleDue)
            {
                var d = row.DueDate.Date;
                var amt = row.AmountDue + row.PenaltyAmount;
                dueByDay[d] = dueByDay.GetValueOrDefault(d) + amt;
            }

            var payments = await (
                from pay in _db.LoanPayments.AsNoTracking()
                join loan in _db.Loans.AsNoTracking() on pay.LoanId equals loan.Id
                where customerIds.Contains(loan.CustomerId)
                      && pay.PaidAt >= fromDate
                      && pay.PaidAt < toDate.AddDays(1)
                select new { pay.PaidAt, pay.Amount, pay.Method }
            ).ToListAsync();

            foreach (var pay in payments)
            {
                var d = pay.PaidAt.Date;
                collectedByDay[d] = collectedByDay.GetValueOrDefault(d) + pay.Amount;
                if (string.Equals((pay.Method ?? "").Trim(), "Cash", StringComparison.OrdinalIgnoreCase))
                    cashByDay[d] = cashByDay.GetValueOrDefault(d) + pay.Amount;
            }
        }

        var points = new List<DashboardTrendPointDto>(days);
        for (var d = fromDate; d <= toDate; d = d.AddDays(1))
        {
            var due = dueByDay.GetValueOrDefault(d);
            var collected = collectedByDay.GetValueOrDefault(d);
            var cash = cashByDay.GetValueOrDefault(d);
            points.Add(new DashboardTrendPointDto(d, due, collected, cash, collected - due));
        }

        return Ok(new DashboardTrendDto(fromDate, toDate, points));
    }
}
