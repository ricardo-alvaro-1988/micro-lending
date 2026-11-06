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
[Route("api/reports")]
[Authorize(Policy = $"perm:{PermissionCodes.ReportsView}")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BranchScopeService _branchScope;
    private readonly LoanFinanceService _finance;

    public ReportsController(AppDbContext db, BranchScopeService branchScope, LoanFinanceService finance)
    {
        _db = db;
        _branchScope = branchScope;
        _finance = finance;
    }

    /// <summary>Due / overdue installments as of a date (office collection list).</summary>
    [HttpGet("due-collections")]
    public async Task<ActionResult<IEnumerable<ReportDueCollectionDto>>> DueCollections(
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var day = (asOf ?? DateTime.UtcNow).Date;
        await _finance.AccrueOpenItemsAsync(day);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        var query =
            from item in _db.LoanScheduleItems.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where item.DueDate < day.AddDays(1)
                  && item.PaidAmount < item.AmountDue + item.PenaltyAmount
                  && (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
            select new { item, loan, customer };

        if (!string.IsNullOrWhiteSpace(agent1UserId))
            query = query.Where(x => x.customer.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            query = query.Where(x => x.customer.GroupId == gid);

        var raw = await query
            .OrderBy(x => x.item.DueDate)
            .ThenBy(x => x.customer.FullName)
            .ThenBy(x => x.item.InstallmentNumber)
            .Select(x => new
            {
                x.item.Id,
                CustomerId = x.customer.Id,
                x.customer.FullName,
                x.customer.Mobile,
                x.customer.GroupId,
                GroupName = x.customer.Group != null ? x.customer.Group.Name : null,
                x.customer.Agent1UserId,
                Agent1Name = x.customer.Agent1 != null ? x.customer.Agent1.FullName : null,
                LoanId = x.loan.Id,
                x.loan.LoanNumber,
                x.item.InstallmentNumber,
                x.item.DueDate,
                x.item.AmountDue,
                x.item.PenaltyAmount,
                x.item.PaidAmount,
                LoanStatus = x.loan.Status
            })
            .ToListAsync();

        var rows = raw.Select(x => new ReportDueCollectionDto(
            x.Id,
            x.CustomerId,
            x.FullName,
            x.Mobile,
            x.GroupId,
            x.GroupName,
            x.Agent1UserId,
            x.Agent1Name,
            x.LoanId,
            x.LoanNumber,
            x.InstallmentNumber,
            x.DueDate,
            x.AmountDue,
            x.PenaltyAmount,
            x.PaidAmount,
            x.AmountDue + x.PenaltyAmount - x.PaidAmount,
            x.DueDate.Date < day,
            x.LoanStatus.ToString())).ToList();

        return Ok(rows);
    }

    /// <summary>Overdue installments with aging buckets.</summary>
    [HttpGet("delinquency-aging")]
    public async Task<ActionResult<ReportAgingResultDto>> DelinquencyAging(
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var day = (asOf ?? DateTime.UtcNow).Date;
        await _finance.AccrueOpenItemsAsync(day);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        var query =
            from item in _db.LoanScheduleItems.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where item.DueDate < day
                  && item.PaidAmount < item.AmountDue + item.PenaltyAmount
                  && (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
            select new { item, loan, customer };

        if (!string.IsNullOrWhiteSpace(agent1UserId))
            query = query.Where(x => x.customer.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            query = query.Where(x => x.customer.GroupId == gid);

        var raw = await query
            .Select(x => new
            {
                x.item.Id,
                CustomerId = x.customer.Id,
                x.customer.FullName,
                Agent1Name = x.customer.Agent1 != null ? x.customer.Agent1.FullName : null,
                GroupName = x.customer.Group != null ? x.customer.Group.Name : null,
                LoanId = x.loan.Id,
                x.loan.LoanNumber,
                x.item.InstallmentNumber,
                x.item.DueDate,
                x.item.AmountDue,
                x.item.PenaltyAmount,
                x.item.PaidAmount
            })
            .ToListAsync();

        var rows = raw
            .Select(x =>
            {
                var days = (day - x.DueDate.Date).Days;
                var remaining = x.AmountDue + x.PenaltyAmount - x.PaidAmount;
                return new ReportAgingRowDto(
                    x.Id,
                    x.CustomerId,
                    x.FullName,
                    x.Agent1Name,
                    x.GroupName,
                    x.LoanId,
                    x.LoanNumber,
                    x.InstallmentNumber,
                    x.DueDate,
                    days,
                    AgingBucket(days),
                    x.AmountDue,
                    x.PaidAmount,
                    remaining);
            })
            .OrderByDescending(x => x.DaysPastDue)
            .ThenBy(x => x.CustomerName)
            .ToList();

        var summary = new[] { "1-7", "8-15", "16-30", "30+" }
            .Select(bucket => new ReportAgingSummaryDto(
                bucket,
                rows.Count(r => r.AgingBucket == bucket),
                rows.Where(r => r.AgingBucket == bucket).Sum(r => r.Remaining)))
            .ToList();

        return Ok(new ReportAgingResultDto(day, summary, rows));
    }

    /// <summary>Expected schedule due vs payments collected, grouped by Agent 1.</summary>
    [HttpGet("agent-collections")]
    public async Task<ActionResult<IEnumerable<ReportAgentCollectionDto>>> AgentCollections(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date).Date;
        var endExclusive = (to ?? start).Date.AddDays(1);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);

        var customerIds = await customers.Select(c => c.Id).ToListAsync();
        if (customerIds.Count == 0)
            return Ok(Array.Empty<ReportAgentCollectionDto>());

        var customerMeta = await customers
            .Select(c => new
            {
                c.Id,
                c.Agent1UserId,
                Agent1Name = c.Agent1 != null ? c.Agent1.FullName : null
            })
            .ToListAsync();

        var expected = await (
            from item in _db.LoanScheduleItems.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
            where customerIds.Contains(loan.CustomerId)
                  && item.DueDate >= start
                  && item.DueDate < endExclusive
                  && (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
            select new { loan.CustomerId, loan.Id, item.AmountDue }
        ).ToListAsync();

        var collected = await (
            from pay in _db.LoanPayments.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on pay.LoanId equals loan.Id
            where customerIds.Contains(loan.CustomerId)
                  && pay.PaidAt >= start
                  && pay.PaidAt < endExclusive
            select new { loan.CustomerId, pay.Amount }
        ).ToListAsync();

        var groups = customerMeta
            .GroupBy(c => c.Agent1UserId ?? "")
            .Select(g =>
            {
                var ids = g.Select(x => x.Id).ToHashSet();
                var name = string.IsNullOrWhiteSpace(g.First().Agent1Name) ? "(Unassigned)" : g.First().Agent1Name!;
                var expRows = expected.Where(e => ids.Contains(e.CustomerId)).ToList();
                var colRows = collected.Where(e => ids.Contains(e.CustomerId)).ToList();
                var expectedDue = expRows.Sum(e => e.AmountDue);
                var collectedAmt = colRows.Sum(e => e.Amount);
                return new ReportAgentCollectionDto(
                    string.IsNullOrEmpty(g.Key) ? null : g.Key,
                    name,
                    ids.Count,
                    expRows.Select(e => e.Id).Distinct().Count(),
                    expectedDue,
                    collectedAmt,
                    collectedAmt - expectedDue);
            })
            .OrderBy(x => x.Agent1Name)
            .ToList();

        return Ok(groups);
    }

    /// <summary>Payment postings audit register.</summary>
    [HttpGet("payment-register")]
    public async Task<ActionResult<IEnumerable<ReportPaymentRegisterDto>>> PaymentRegister(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? method = null,
        [FromQuery] string? recordedByUserId = null,
        [FromQuery] string? agent1UserId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date).Date;
        var endExclusive = (to ?? start).Date.AddDays(1);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        var query =
            from pay in _db.LoanPayments.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on pay.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where pay.PaidAt >= start && pay.PaidAt < endExclusive
            select new { pay, loan, customer };

        if (!string.IsNullOrWhiteSpace(method))
            query = query.Where(x => x.pay.Method == method);
        if (!string.IsNullOrWhiteSpace(recordedByUserId))
            query = query.Where(x => x.pay.RecordedByUserId == recordedByUserId);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            query = query.Where(x => x.customer.Agent1UserId == agent1UserId);

        var rows = await query
            .OrderByDescending(x => x.pay.PaidAt)
            .ThenByDescending(x => x.pay.Id)
            .Select(x => new ReportPaymentRegisterDto(
                x.pay.Id,
                x.pay.PaidAt,
                x.pay.Amount,
                x.pay.Method,
                x.pay.Reference,
                x.pay.RecordedByUser.FullName,
                x.pay.RecordedByUserId,
                x.customer.Id,
                x.customer.FullName,
                x.customer.Agent1 != null ? x.customer.Agent1.FullName : null,
                x.loan.Id,
                x.loan.LoanNumber,
                x.customer.BranchId,
                x.customer.Branch != null ? x.customer.Branch.Name : null))
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>Active portfolio outstanding and overdue totals.</summary>
    [HttpGet("portfolio-summary")]
    public async Task<ActionResult<ReportPortfolioSummaryDto>> PortfolioSummary(
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var day = (asOf ?? DateTime.UtcNow).Date;
        await _finance.AccrueOpenItemsAsync(day);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            customers = customers.Where(c => c.GroupId == gid);

        var loansQuery =
            from loan in _db.Loans.AsNoTracking()
            join customer in customers on loan.CustomerId equals customer.Id
            where loan.Status == LoanStatus.ApprovedFinal
            select new { loan, customer };

        var loanRows = await loansQuery
            .Select(x => new
            {
                LoanId = x.loan.Id,
                x.loan.LoanNumber,
                CustomerId = x.customer.Id,
                x.customer.FullName,
                Agent1Name = x.customer.Agent1 != null ? x.customer.Agent1.FullName : null,
                GroupName = x.customer.Group != null ? x.customer.Group.Name : null,
                x.customer.BranchId,
                BranchName = x.customer.Branch != null ? x.customer.Branch.Name : null,
                Status = x.loan.Status.ToString(),
                x.loan.TotalPayable
            })
            .ToListAsync();

        var loanIds = loanRows.Select(l => l.LoanId).ToList();
        var payments = await _db.LoanPayments.AsNoTracking()
            .Where(p => loanIds.Contains(p.LoanId))
            .GroupBy(p => p.LoanId)
            .Select(g => new { LoanId = g.Key, TotalPaid = g.Sum(p => p.Amount) })
            .ToListAsync();
        var paidMap = payments.ToDictionary(p => p.LoanId, p => p.TotalPaid);

        var schedule = await _db.LoanScheduleItems.AsNoTracking()
            .Where(s => loanIds.Contains(s.LoanId) && s.DueDate < day && s.PaidAmount < s.AmountDue + s.PenaltyAmount)
            .Select(s => new { s.LoanId, Remaining = s.AmountDue + s.PenaltyAmount - s.PaidAmount })
            .ToListAsync();

        var overdueByLoan = schedule
            .GroupBy(s => s.LoanId)
            .ToDictionary(
                g => g.Key,
                g => (Remaining: g.Sum(x => x.Remaining), Count: g.Count()));

        var loans = loanRows.Select(l =>
        {
            var paid = paidMap.GetValueOrDefault(l.LoanId);
            var remaining = l.TotalPayable - paid;
            if (remaining < 0) remaining = 0;
            overdueByLoan.TryGetValue(l.LoanId, out var od);
            return new ReportPortfolioLoanDto(
                l.LoanId,
                l.LoanNumber,
                l.CustomerId,
                l.FullName,
                l.Agent1Name,
                l.GroupName,
                l.BranchId,
                l.BranchName,
                l.Status,
                l.TotalPayable,
                paid,
                remaining,
                od.Remaining,
                od.Count);
        })
        .OrderByDescending(l => l.OverdueRemaining)
        .ThenBy(l => l.CustomerName)
        .ToList();

        var dto = new ReportPortfolioSummaryDto(
            day,
            loans.Count,
            loans.Sum(l => l.TotalPayable),
            loans.Sum(l => l.TotalPaid),
            loans.Sum(l => l.Remaining),
            loans.Sum(l => l.OverdueRemaining),
            loans.Count(l => l.OverdueInstallments > 0),
            loans);

        return Ok(dto);
    }

    /// <summary>Loans released / approved-final in a period.</summary>
    [HttpGet("loan-releases")]
    public async Task<ActionResult<IEnumerable<ReportLoanReleaseDto>>> LoanReleases(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date).Date;
        var endExclusive = (to ?? start).Date.AddDays(1);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            customers = customers.Where(c => c.GroupId == gid);

        var activityReleases = await (
            from act in _db.LoanActivities.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on act.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where act.Type == LoanActivityType.ApprovedFinal
                  && act.OccurredAt >= start
                  && act.OccurredAt < endExclusive
            select new ReportLoanReleaseDto(
                loan.Id,
                loan.LoanNumber,
                customer.Id,
                customer.FullName,
                customer.Agent1 != null ? customer.Agent1.FullName : null,
                customer.Group != null ? customer.Group.Name : null,
                customer.BranchId,
                customer.Branch != null ? customer.Branch.Name : null,
                act.OccurredAt,
                loan.Amount,
                loan.TotalPayable,
                loan.Status.ToString())
        ).ToListAsync();

        if (activityReleases.Count > 0)
            return Ok(activityReleases.OrderBy(x => x.ReleasedAt).ThenBy(x => x.CustomerName).ToList());

        // Fallback when ApprovedFinal activities were never written.
        var fallback = await (
            from loan in _db.Loans.AsNoTracking()
            join customer in customers on loan.CustomerId equals customer.Id
            where (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
                  && loan.UpdatedAt >= start
                  && loan.UpdatedAt < endExclusive
            select new ReportLoanReleaseDto(
                loan.Id,
                loan.LoanNumber,
                customer.Id,
                customer.FullName,
                customer.Agent1 != null ? customer.Agent1.FullName : null,
                customer.Group != null ? customer.Group.Name : null,
                customer.BranchId,
                customer.Branch != null ? customer.Branch.Name : null,
                loan.UpdatedAt,
                loan.Amount,
                loan.TotalPayable,
                loan.Status.ToString())
        ).OrderBy(x => x.ReleasedAt).ThenBy(x => x.CustomerName).ToListAsync();

        return Ok(fallback);
    }

    /// <summary>Expected schedule due vs payments collected by day.</summary>
    [HttpGet("expected-vs-actual")]
    public async Task<ActionResult<ReportExpectedActualResultDto>> ExpectedVsActual(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date).Date;
        var end = (to ?? start).Date;
        var endExclusive = end.AddDays(1);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            customers = customers.Where(c => c.GroupId == gid);

        var customerIds = await customers.Select(c => c.Id).ToListAsync();

        var expectedRaw = customerIds.Count == 0
            ? new List<(DateTime Day, decimal Amount)>()
            : (await (
                from item in _db.LoanScheduleItems.AsNoTracking()
                join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
                where customerIds.Contains(loan.CustomerId)
                      && item.DueDate >= start
                      && item.DueDate < endExclusive
                      && (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
                select new { item.DueDate, item.AmountDue }
            ).ToListAsync())
            .Select(x => (Day: x.DueDate.Date, Amount: x.AmountDue))
            .ToList();

        var collectedRaw = customerIds.Count == 0
            ? new List<(DateTime Day, decimal Amount)>()
            : (await (
                from pay in _db.LoanPayments.AsNoTracking()
                join loan in _db.Loans.AsNoTracking() on pay.LoanId equals loan.Id
                where customerIds.Contains(loan.CustomerId)
                      && pay.PaidAt >= start
                      && pay.PaidAt < endExclusive
                select new { pay.PaidAt, pay.Amount }
            ).ToListAsync())
            .Select(x => (Day: x.PaidAt.Date, Amount: x.Amount))
            .ToList();

        var days = new List<ReportExpectedActualDayDto>();
        for (var d = start; d <= end; d = d.AddDays(1))
        {
            var exp = expectedRaw.Where(x => x.Day == d).Sum(x => x.Amount);
            var col = collectedRaw.Where(x => x.Day == d).Sum(x => x.Amount);
            days.Add(new ReportExpectedActualDayDto(d, exp, col, col - exp));
        }

        var totalExp = days.Sum(x => x.ExpectedDue);
        var totalCol = days.Sum(x => x.Collected);
        return Ok(new ReportExpectedActualResultDto(start, end, totalExp, totalCol, totalCol - totalExp, days));
    }

    /// <summary>Portfolio at Risk (PAR 1 / 7 / 30).</summary>
    [HttpGet("par")]
    public async Task<ActionResult<ReportParResultDto>> PortfolioAtRisk(
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var day = (asOf ?? DateTime.UtcNow).Date;
        await _finance.AccrueOpenItemsAsync(day);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            customers = customers.Where(c => c.GroupId == gid);

        var loanRows = await (
            from loan in _db.Loans.AsNoTracking()
            join customer in customers on loan.CustomerId equals customer.Id
            where loan.Status == LoanStatus.ApprovedFinal
            select new
            {
                LoanId = loan.Id,
                loan.LoanNumber,
                CustomerId = customer.Id,
                customer.FullName,
                Agent1Name = customer.Agent1 != null ? customer.Agent1.FullName : null,
                GroupName = customer.Group != null ? customer.Group.Name : null,
                loan.TotalPayable
            }).ToListAsync();

        var loanIds = loanRows.Select(l => l.LoanId).ToList();
        var paidMap = await _db.LoanPayments.AsNoTracking()
            .Where(p => loanIds.Contains(p.LoanId))
            .GroupBy(p => p.LoanId)
            .Select(g => new { LoanId = g.Key, Paid = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.LoanId, x => x.Paid);

        var overdueItems = await _db.LoanScheduleItems.AsNoTracking()
            .Where(s => loanIds.Contains(s.LoanId) && s.DueDate < day && s.PaidAmount < s.AmountDue + s.PenaltyAmount)
            .Select(s => new { s.LoanId, s.DueDate })
            .ToListAsync();

        var maxDpd = overdueItems
            .GroupBy(x => x.LoanId)
            .ToDictionary(g => g.Key, g => g.Max(x => (day - x.DueDate.Date).Days));

        var loans = loanRows.Select(l =>
        {
            var paid = paidMap.GetValueOrDefault(l.LoanId);
            var outstanding = Math.Max(0, l.TotalPayable - paid);
            var dpd = maxDpd.GetValueOrDefault(l.LoanId);
            return new ReportParLoanDto(
                l.LoanId,
                l.LoanNumber,
                l.CustomerId,
                l.FullName,
                l.Agent1Name,
                l.GroupName,
                outstanding,
                dpd,
                dpd >= 1,
                dpd >= 7,
                dpd >= 30);
        }).ToList();

        var portfolio = loans.Sum(l => l.Outstanding);
        var par1 = loans.Where(l => l.InPar1).Sum(l => l.Outstanding);
        var par7 = loans.Where(l => l.InPar7).Sum(l => l.Outstanding);
        var par30 = loans.Where(l => l.InPar30).Sum(l => l.Outstanding);
        decimal Pct(decimal part) => portfolio <= 0 ? 0 : Math.Round(part / portfolio * 100m, 2);

        return Ok(new ReportParResultDto(
            day,
            portfolio,
            par1,
            par7,
            par30,
            Pct(par1),
            Pct(par7),
            Pct(par30),
            loans.Where(l => l.InPar1).OrderByDescending(l => l.MaxDaysPastDue).ThenBy(l => l.CustomerName).ToList()));
    }

    /// <summary>Closed or fully paid (matured) loans in a period.</summary>
    [HttpGet("closed-loans")]
    public async Task<ActionResult<IEnumerable<ReportClosedLoanDto>>> ClosedLoans(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date).Date;
        var endExclusive = (to ?? start).Date.AddDays(1);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            customers = customers.Where(c => c.GroupId == gid);

        var closedActs = await (
            from act in _db.LoanActivities.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on act.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where act.Type == LoanActivityType.Closed
                  && act.OccurredAt >= start
                  && act.OccurredAt < endExclusive
            select new
            {
                LoanId = loan.Id,
                loan.LoanNumber,
                CustomerId = customer.Id,
                customer.FullName,
                Agent1Name = customer.Agent1 != null ? customer.Agent1.FullName : null,
                GroupName = customer.Group != null ? customer.Group.Name : null,
                Status = loan.Status.ToString(),
                act.OccurredAt,
                loan.TotalPayable
            }
        ).ToListAsync();

        var closedIds = closedActs.Select(x => x.LoanId).ToHashSet();
        var paidTotals = await _db.LoanPayments.AsNoTracking()
            .Where(p => closedIds.Contains(p.LoanId))
            .GroupBy(p => p.LoanId)
            .Select(g => new { LoanId = g.Key, Paid = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.LoanId, x => x.Paid);

        var results = closedActs.Select(x => new ReportClosedLoanDto(
            x.LoanId,
            x.LoanNumber,
            x.CustomerId,
            x.FullName,
            x.Agent1Name,
            x.GroupName,
            x.Status,
            x.OccurredAt,
            "Closed",
            x.TotalPayable,
            paidTotals.GetValueOrDefault(x.LoanId))).ToList();

        // Fully paid ApprovedFinal loans whose last payment falls in the period.
        var active = await (
            from loan in _db.Loans.AsNoTracking()
            join customer in customers on loan.CustomerId equals customer.Id
            where loan.Status == LoanStatus.ApprovedFinal && !closedIds.Contains(loan.Id)
            select new
            {
                LoanId = loan.Id,
                loan.LoanNumber,
                CustomerId = customer.Id,
                customer.FullName,
                Agent1Name = customer.Agent1 != null ? customer.Agent1.FullName : null,
                GroupName = customer.Group != null ? customer.Group.Name : null,
                Status = loan.Status.ToString(),
                loan.TotalPayable
            }
        ).ToListAsync();

        var activeIds = active.Select(x => x.LoanId).ToList();
        if (activeIds.Count > 0)
        {
            var pays = await _db.LoanPayments.AsNoTracking()
                .Where(p => activeIds.Contains(p.LoanId))
                .Select(p => new { p.LoanId, p.Amount, p.PaidAt })
                .ToListAsync();
            var byLoan = pays.GroupBy(p => p.LoanId).ToDictionary(g => g.Key, g => g.ToList());

            foreach (var row in active)
            {
                if (!byLoan.TryGetValue(row.LoanId, out var list) || list.Count == 0) continue;
                var totalPaid = list.Sum(p => p.Amount);
                if (totalPaid + 0.009m < row.TotalPayable) continue;
                var lastPay = list.Max(p => p.PaidAt);
                if (lastPay < start || lastPay >= endExclusive) continue;
                results.Add(new ReportClosedLoanDto(
                    row.LoanId,
                    row.LoanNumber,
                    row.CustomerId,
                    row.FullName,
                    row.Agent1Name,
                    row.GroupName,
                    row.Status,
                    lastPay,
                    "Fully paid",
                    row.TotalPayable,
                    totalPaid));
            }
        }

        return Ok(results.OrderBy(x => x.ClosedAt).ThenBy(x => x.CustomerName).ToList());
    }

    /// <summary>Group / cluster collection sheet for a due date.</summary>
    [HttpGet("group-collection-sheet")]
    public async Task<ActionResult<IEnumerable<ReportDueCollectionDto>>> GroupCollectionSheet(
        [FromQuery] DateTime? asOf = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? groupId = null,
        [FromQuery] string? agent1UserId = null)
    {
        // Same data as due-collections; UI groups by cluster. Require explicit asOf day focus.
        return await DueCollections(asOf, branchId, agent1UserId, groupId);
    }

    /// <summary>Bulk statement lines for export across scoped customers.</summary>
    [HttpGet("statements")]
    public async Task<ActionResult<IEnumerable<ReportStatementExportLineDto>>> StatementsExport(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = from?.Date;
        var endExclusive = to?.Date.AddDays(1);

        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            customers = customers.Where(c => c.GroupId == gid);

        var loanRows = await (
            from loan in _db.Loans.AsNoTracking()
            join customer in customers on loan.CustomerId equals customer.Id
            select new { loan, customer }
        ).ToListAsync();

        var loanIds = loanRows.Select(x => x.loan.Id).ToList();
        var payments = await _db.LoanPayments.AsNoTracking()
            .Where(p => loanIds.Contains(p.LoanId))
            .OrderBy(p => p.PaidAt)
            .ThenBy(p => p.Id)
            .ToListAsync();
        var paysByLoan = payments.GroupBy(p => p.LoanId).ToDictionary(g => g.Key, g => g.ToList());

        var export = new List<ReportStatementExportLineDto>();
        foreach (var row in loanRows.OrderBy(x => x.customer.FullName).ThenBy(x => x.loan.CreatedAt))
        {
            var lines = new List<(DateTime Date, string Type, string Description, decimal Debit, decimal Credit)>();
            if (row.loan.TotalPayable > 0)
            {
                lines.Add((
                    row.loan.CreatedAt,
                    "Charge",
                    $"Loan {row.loan.LoanNumber} principal + interest",
                    row.loan.TotalPayable,
                    0));
            }

            if (paysByLoan.TryGetValue(row.loan.Id, out var pays))
            {
                foreach (var p in pays)
                {
                    lines.Add((
                        p.PaidAt,
                        "Payment",
                        $"Payment on {row.loan.LoanNumber}" + (string.IsNullOrWhiteSpace(p.Reference) ? "" : $" ({p.Reference})"),
                        0,
                        p.Amount));
                }
            }

            decimal opening = 0;
            decimal balance = 0;
            var started = false;
            foreach (var line in lines.OrderBy(l => l.Date).ThenBy(l => l.Type == "Charge" ? 0 : 1))
            {
                var inRange = (!start.HasValue || line.Date >= start.Value)
                              && (!endExclusive.HasValue || line.Date < endExclusive.Value);
                if (!inRange)
                {
                    if (start.HasValue && line.Date < start.Value)
                        opening += line.Debit - line.Credit;
                    continue;
                }

                if (!started)
                {
                    balance = start.HasValue ? opening : 0;
                    started = true;
                }

                balance += line.Debit - line.Credit;
                export.Add(new ReportStatementExportLineDto(
                    row.customer.Id,
                    row.customer.FullName,
                    row.loan.Id,
                    row.loan.LoanNumber,
                    line.Date,
                    line.Type,
                    line.Description,
                    line.Debit,
                    line.Credit,
                    balance));
            }
        }

        return Ok(export);
    }

    /// <summary>Interest accrued (schedule) vs collected (pro-rata of paid) for dues in period.</summary>
    [HttpGet("interest-income")]
    public async Task<ActionResult<ReportInterestIncomeResultDto>> InterestIncome(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date).Date;
        var endExclusive = (to ?? start).Date.AddDays(1);

        var customers = ScopedCustomers(scope, agent1UserId, groupId);
        var raw = await (
            from item in _db.LoanScheduleItems.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on item.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where item.DueDate >= start
                  && item.DueDate < endExclusive
                  && (loan.Status == LoanStatus.ApprovedFinal || loan.Status == LoanStatus.Closed)
            select new
            {
                LoanId = loan.Id,
                loan.LoanNumber,
                CustomerId = customer.Id,
                customer.FullName,
                Agent1Name = customer.Agent1 != null ? customer.Agent1.FullName : null,
                item.InterestPortion,
                item.AmountDue,
                item.PaidAmount
            }).ToListAsync();

        var rows = raw
            .GroupBy(x => x.LoanId)
            .Select(g =>
            {
                var first = g.First();
                var accrued = g.Sum(x => x.InterestPortion);
                var collected = g.Sum(x =>
                    x.AmountDue <= 0
                        ? 0
                        : Math.Round(x.PaidAmount * x.InterestPortion / x.AmountDue, 2, MidpointRounding.AwayFromZero));
                return new ReportInterestIncomeRowDto(
                    first.LoanId,
                    first.LoanNumber,
                    first.CustomerId,
                    first.FullName,
                    first.Agent1Name,
                    accrued,
                    collected,
                    collected - accrued);
            })
            .OrderBy(x => x.CustomerName)
            .ToList();

        var totalAccrued = rows.Sum(r => r.AccruedInterest);
        var totalCollected = rows.Sum(r => r.CollectedInterest);
        return Ok(new ReportInterestIncomeResultDto(
            start,
            endExclusive.AddDays(-1),
            totalAccrued,
            totalCollected,
            totalCollected - totalAccrued,
            rows));
    }

    /// <summary>Approval pipeline turnaround time by stage.</summary>
    [HttpGet("approval-tat")]
    public async Task<ActionResult<ReportApprovalTatResultDto>> ApprovalTat(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date;
        var endExclusive = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var customers = ScopedCustomers(scope, agent1UserId, groupId);
        var raw = await (
            from appr in _db.LoanApprovals.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on appr.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where appr.RequestedAt >= start && appr.RequestedAt < endExclusive
            select new
            {
                appr.Id,
                LoanId = loan.Id,
                loan.LoanNumber,
                CustomerId = customer.Id,
                customer.FullName,
                StageName = appr.Stage.Name,
                Decision = appr.Decision,
                appr.RequestedAt,
                appr.DecidedAt,
                DecidedBy = appr.DecidedByUser != null ? appr.DecidedByUser.FullName : null,
                appr.Comments
            }).ToListAsync();

        var rows = raw
            .Select(x =>
            {
                double? hours = x.DecidedAt is DateTime decided
                    ? Math.Round((decided - x.RequestedAt).TotalHours, 2)
                    : null;
                return new ReportApprovalTatRowDto(
                    x.Id,
                    x.LoanId,
                    x.LoanNumber,
                    x.CustomerId,
                    x.FullName,
                    x.StageName,
                    x.Decision.ToString(),
                    x.RequestedAt,
                    x.DecidedAt,
                    hours,
                    x.DecidedBy,
                    x.Comments);
            })
            .OrderByDescending(x => x.RequestedAt)
            .ToList();

        var decided = rows.Where(r => r.HoursToDecision.HasValue).ToList();
        var byStage = decided
            .GroupBy(r => r.StageName)
            .Select(g =>
            {
                var hours = g.Select(x => x.HoursToDecision!.Value).OrderBy(v => v).ToList();
                return new ReportApprovalTatStageDto(
                    g.Key,
                    hours.Count,
                    hours.Count == 0 ? null : Math.Round(hours.Average(), 2),
                    hours.Count == 0 ? null : Median(hours));
            })
            .OrderBy(x => x.StageName)
            .ToList();

        return Ok(new ReportApprovalTatResultDto(
            start,
            endExclusive.AddDays(-1),
            rows.Count(r => r.Decision == nameof(ApprovalDecision.Pending)),
            decided.Count,
            decided.Count == 0 ? null : Math.Round(decided.Average(r => r.HoursToDecision!.Value), 2),
            byStage,
            rows));
    }

    /// <summary>Rejected / declined loan applications in a period.</summary>
    [HttpGet("rejected-applications")]
    public async Task<ActionResult<IEnumerable<ReportRejectedApplicationDto>>> RejectedApplications(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date;
        var endExclusive = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var customers = ScopedCustomers(scope, agent1UserId, groupId);

        var rejectedActs = await (
            from act in _db.LoanActivities.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on act.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where (act.Type == LoanActivityType.Rejected || act.Type == LoanActivityType.Declined)
                  && act.OccurredAt >= start
                  && act.OccurredAt < endExclusive
            select new
            {
                LoanId = loan.Id,
                loan.LoanNumber,
                CustomerId = customer.Id,
                customer.FullName,
                Agent1Name = customer.Agent1 != null ? customer.Agent1.FullName : null,
                GroupName = customer.Group != null ? customer.Group.Name : null,
                Status = loan.Status.ToString(),
                act.OccurredAt,
                act.StageName,
                act.Notes,
                loan.Amount
            }).ToListAsync();

        var seen = new HashSet<int>();
        var rows = new List<ReportRejectedApplicationDto>();
        foreach (var x in rejectedActs.OrderByDescending(a => a.OccurredAt))
        {
            if (!seen.Add(x.LoanId)) continue;
            rows.Add(new ReportRejectedApplicationDto(
                x.LoanId,
                x.LoanNumber,
                x.CustomerId,
                x.FullName,
                x.Agent1Name,
                x.GroupName,
                x.Status,
                x.OccurredAt,
                x.StageName,
                x.Notes,
                x.Amount));
        }

        // Fallback: Rejected status updated in period without activity.
        var fallback = await (
            from loan in _db.Loans.AsNoTracking()
            join customer in customers on loan.CustomerId equals customer.Id
            where loan.Status == LoanStatus.Rejected
                  && loan.UpdatedAt >= start
                  && loan.UpdatedAt < endExclusive
                  && !seen.Contains(loan.Id)
            select new ReportRejectedApplicationDto(
                loan.Id,
                loan.LoanNumber,
                customer.Id,
                customer.FullName,
                customer.Agent1 != null ? customer.Agent1.FullName : null,
                customer.Group != null ? customer.Group.Name : null,
                loan.Status.ToString(),
                loan.UpdatedAt,
                loan.CurrentStage != null ? loan.CurrentStage.Name : null,
                loan.Notes,
                loan.Amount)
        ).ToListAsync();

        rows.AddRange(fallback);
        return Ok(rows.OrderByDescending(r => r.RejectedAt).ToList());
    }

    /// <summary>Customer master with agent / group / branch assignment.</summary>
    [HttpGet("customer-assignments")]
    public async Task<ActionResult<IEnumerable<ReportCustomerAssignmentDto>>> CustomerAssignments(
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var customers = ScopedCustomers(scope, agent1UserId, groupId);
        var rows = await customers
            .OrderBy(c => c.FullName)
            .Select(c => new ReportCustomerAssignmentDto(
                c.Id,
                c.FullName,
                c.Mobile,
                c.BranchId,
                c.Branch != null ? c.Branch.Name : null,
                c.GroupId,
                c.Group != null ? c.Group.Name : null,
                c.Agent1UserId,
                c.Agent1 != null ? c.Agent1.FullName : null,
                c.Agent2 != null ? c.Agent2.FullName : null,
                c.Agent3 != null ? c.Agent3.FullName : null,
                c.Loans.Count,
                c.Loans.Count(l => l.Status == LoanStatus.ApprovedFinal),
                c.CreatedAt))
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>Field visit / notes log.</summary>
    [HttpGet("field-notes-log")]
    public async Task<ActionResult<IEnumerable<ReportFieldNoteLogDto>>> FieldNotesLog(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] string? createdByUserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date;
        var endExclusive = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var customers = ScopedCustomers(scope, agent1UserId, groupId);
        var query =
            from note in _db.LoanFieldNotes.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on note.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where note.CreatedAt >= start && note.CreatedAt < endExclusive
            select new { note, loan, customer };

        if (!string.IsNullOrWhiteSpace(createdByUserId))
            query = query.Where(x => x.note.CreatedByUserId == createdByUserId);

        var rows = await query
            .OrderByDescending(x => x.note.CreatedAt)
            .Select(x => new ReportFieldNoteLogDto(
                x.note.Id,
                x.loan.Id,
                x.loan.LoanNumber,
                x.customer.Id,
                x.customer.FullName,
                x.customer.Agent1 != null ? x.customer.Agent1.FullName : null,
                x.note.Body,
                x.note.CreatedByUser.FullName,
                x.note.CreatedByUserId,
                x.note.CreatedAt,
                x.note.Attachments.Count))
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>Cash vs other payment methods breakdown.</summary>
    [HttpGet("payment-methods")]
    public async Task<ActionResult<ReportPaymentMethodResultDto>> PaymentMethods(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? agent1UserId = null,
        [FromQuery] int? groupId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();
        if (scope.IsFieldAgent) return Forbid();

        var start = (from ?? DateTime.UtcNow.Date).Date;
        var endExclusive = (to ?? start).Date.AddDays(1);

        var customers = ScopedCustomers(scope, agent1UserId, groupId);
        var pays = await (
            from pay in _db.LoanPayments.AsNoTracking()
            join loan in _db.Loans.AsNoTracking() on pay.LoanId equals loan.Id
            join customer in customers on loan.CustomerId equals customer.Id
            where pay.PaidAt >= start && pay.PaidAt < endExclusive
            select new { pay.Method, pay.Amount }
        ).ToListAsync();

        var methods = pays
            .GroupBy(p => string.IsNullOrWhiteSpace(p.Method) ? "(Unspecified)" : p.Method!.Trim())
            .Select(g => new ReportPaymentMethodDto(g.Key, g.Count(), g.Sum(x => x.Amount)))
            .OrderByDescending(m => m.TotalAmount)
            .ToList();

        return Ok(new ReportPaymentMethodResultDto(start, endExclusive.AddDays(-1), methods.Sum(m => m.TotalAmount), methods));
    }

    private IQueryable<Customer> ScopedCustomers(BranchScope scope, string? agent1UserId, int? groupId)
    {
        var customers = BranchScopeService.Customers(_db.Customers.AsNoTracking(), scope);
        if (!string.IsNullOrWhiteSpace(agent1UserId))
            customers = customers.Where(c => c.Agent1UserId == agent1UserId);
        if (groupId is int gid)
            customers = customers.Where(c => c.GroupId == gid);
        return customers;
    }

    private static string AgingBucket(int daysPastDue) => daysPastDue switch
    {
        <= 7 => "1-7",
        <= 15 => "8-15",
        <= 30 => "16-30",
        _ => "30+"
    };

    private static double Median(List<double> sorted)
    {
        if (sorted.Count == 0) return 0;
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 0
            ? Math.Round((sorted[mid - 1] + sorted[mid]) / 2.0, 2)
            : sorted[mid];
    }
}
