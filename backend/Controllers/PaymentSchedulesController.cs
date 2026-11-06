using System.Security.Claims;
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
[Route("api/payment-schedules")]
[Authorize]
public class PaymentSchedulesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly LoanFinanceService _finance;
    private readonly BranchScopeService _branchScope;

    public PaymentSchedulesController(
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

    [HttpGet("assignees")]
    [Authorize(Policy = $"perm:{PermissionCodes.PaymentScheduleSettings}")]
    public async Task<ActionResult<IEnumerable<PaymentScheduleAssigneeDto>>> GetAssignees()
    {
        var list = await _db.PaymentScheduleAssignees
            .Include(a => a.User)
            .OrderBy(a => a.User.FullName)
            .Select(a => new PaymentScheduleAssigneeDto(
                a.UserId,
                a.User.FullName,
                a.User.Email ?? string.Empty))
            .ToListAsync();
        return Ok(list);
    }

    [HttpPut("assignees")]
    [Authorize(Policy = $"perm:{PermissionCodes.PaymentScheduleSettings}")]
    public async Task<ActionResult<IEnumerable<PaymentScheduleAssigneeDto>>> UpdateAssignees(
        [FromBody] UpdatePaymentScheduleAssigneesRequest request)
    {
        var requested = (request.UserIds ?? new List<string>())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (requested.Count > 0)
        {
            var validIds = await _userManager.Users
                .Where(u => !u.IsDeleted && requested.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();
            if (validIds.Count != requested.Count)
                return BadRequest(new { message = "One or more selected users are invalid or inactive." });
        }

        var existing = await _db.PaymentScheduleAssignees.ToListAsync();
        _db.PaymentScheduleAssignees.RemoveRange(existing);

        foreach (var userId in requested)
        {
            _db.PaymentScheduleAssignees.Add(new PaymentScheduleAssignee
            {
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return await GetAssignees();
    }

    [HttpGet("pending")]
    [Authorize(Policy = $"perm:{PermissionCodes.PaymentScheduleView}")]
    public async Task<ActionResult<IEnumerable<PendingPaymentScheduleDto>>> GetPending([FromQuery] int? branchId = null)
    {
        var scope = await _branchScope.ResolveAsync(User, branchId);
        if (scope is null) return Unauthorized();

        var canManage = User.HasClaim("permission", PermissionCodes.PaymentScheduleManage)
                        || User.HasClaim("permission", PermissionCodes.LoansManage);
        var items = await LoadPendingAsync(canManage, scope);
        return Ok(items);
    }

    [HttpGet("mine/summary")]
    [Authorize(Policy = $"perm:{PermissionCodes.PaymentScheduleView}")]
    public async Task<ActionResult<PaymentScheduleNotificationSummaryDto>> MySummary()
    {
        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var isAssignee = await _db.PaymentScheduleAssignees.AnyAsync(a => a.UserId == scope.UserId);
        var canManage = User.HasClaim("permission", PermissionCodes.PaymentScheduleManage)
                        || User.HasClaim("permission", PermissionCodes.LoansManage);

        // Only assigned users (or admins with settings) get urgent notification counts.
        var notify = isAssignee || User.HasClaim("permission", PermissionCodes.PaymentScheduleSettings);
        if (!notify)
            return Ok(new PaymentScheduleNotificationSummaryDto(0, false, Array.Empty<PendingPaymentScheduleDto>()));

        var items = await LoadPendingAsync(canManage, scope);
        return Ok(new PaymentScheduleNotificationSummaryDto(items.Count, isAssignee, items.Take(5).ToList()));
    }

    [HttpPut("{loanId:int}/terms")]
    [Authorize(Policy = $"perm:{PermissionCodes.PaymentScheduleManage}")]
    public async Task<ActionResult<object>> UpdateTerms(int loanId, [FromBody] UpdateLoanTermsRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var isAssignee = await _db.PaymentScheduleAssignees.AnyAsync(a => a.UserId == user.Id);
        var isSettingsAdmin = User.HasClaim("permission", PermissionCodes.PaymentScheduleSettings);
        if (!isAssignee && !isSettingsAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only assigned payment-schedule users can set terms here." });

        var scope = await _branchScope.ResolveAsync(User);
        if (scope is null) return Unauthorized();

        var loan = await _finance.LoadLoanFinanceAsync(loanId);
        if (loan is null) return NotFound();
        if (!BranchScopeService.CanAccessBranch(scope, loan.Customer.BranchId)) return NotFound();

        if (loan.Status is not (LoanStatus.ApprovedFinal or LoanStatus.Closed))
            return BadRequest(new { message = "Payment schedule is only for Approved-Final loans." });
        if (loan.Payments.Any())
            return BadRequest(new { message = "Cannot change terms after payments have been recorded." });

        if (!TryParseFrequency(request.PaymentFrequency, out var frequency))
            return BadRequest(new { message = "Payment frequency must be Daily, Weekly, BiWeekly, or Monthly." });
        if (!LoanFinanceService.TryParseInterestMethod(request.InterestMethod, out var interestMethod))
            return BadRequest(new { message = "Interest method must be Flat or DecliningBalance." });

        if (request.LoanProductId is int productId)
        {
            var product = await _db.LoanProducts.FirstOrDefaultAsync(p => p.Id == productId);
            if (product is null) return BadRequest(new { message = "Loan product not found." });
            if (!product.IsActive && loan.LoanProductId != product.Id)
                return BadRequest(new { message = "Selected loan product is inactive." });
            loan.LoanProductId = product.Id;
            if (string.IsNullOrWhiteSpace(request.InterestMethod))
                interestMethod = product.InterestMethod;
        }
        else
        {
            loan.LoanProductId = null;
        }

        try
        {
            LoanFinanceService.ApplyTerms(
                loan,
                request.Amount,
                request.InterestRatePercent,
                request.TermCount,
                frequency,
                request.FirstDueDate,
                interestMethod);
            loan.Notes = string.IsNullOrWhiteSpace(request.Notes) ? loan.Notes : request.Notes.Trim();
            _finance.RebuildSchedule(loan);
            await _db.SaveChangesAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        return Ok(new
        {
            loan = new
            {
                loan.Id,
                loan.LoanNumber,
                loan.Amount,
                loan.InterestRatePercent,
                loan.TermCount,
                paymentFrequency = loan.PaymentFrequency.ToString(),
                interestMethod = loan.InterestMethod.ToString(),
                loanProductId = loan.LoanProductId,
                loan.FirstDueDate,
                loan.InterestAmount,
                loan.TotalPayable,
                loan.InstallmentAmount,
                hasTerms = loan.TermCount > 0 && loan.FirstDueDate is not null
            },
            schedule = loan.ScheduleItems
                .OrderBy(s => s.InstallmentNumber)
                .Select(s => new
                {
                    s.Id,
                    s.InstallmentNumber,
                    s.DueDate,
                    s.AmountDue,
                    s.PrincipalPortion,
                    s.InterestPortion,
                    s.PenaltyAmount,
                    s.PaidAmount,
                    balance = Math.Max(0, s.AmountDue + s.PenaltyAmount - s.PaidAmount),
                    status = s.Status.ToString()
                })
        });
    }

    private async Task<List<PendingPaymentScheduleDto>> LoadPendingAsync(bool canManage, BranchScope scope)
    {
        var now = DateTime.UtcNow;
        var query = BranchScopeService.Loans(
            _db.Loans
                .Include(l => l.Customer)
                .Include(l => l.Flow)
                .Include(l => l.CurrentStage)
                .Where(l => l.Status == LoanStatus.ApprovedFinal || l.Status == LoanStatus.Closed)
                .Where(l => l.TermCount <= 0 || l.FirstDueDate == null),
            scope);

        var loans = await query.OrderBy(l => l.UpdatedAt).Take(100).ToListAsync();

        return loans.Select(l =>
        {
            var waiting = Math.Max(0, (int)(now - l.UpdatedAt).TotalHours);
            return new PendingPaymentScheduleDto(
                l.Id,
                l.LoanNumber,
                l.CustomerId,
                l.Customer.FullName,
                l.Amount,
                l.Flow.Name,
                l.CurrentStage.Name,
                l.Status.ToString(),
                l.UpdatedAt,
                waiting,
                canManage);
        }).ToList();
    }

    private static bool TryParseFrequency(string? value, out PaymentFrequency frequency)
    {
        frequency = PaymentFrequency.Monthly;
        if (string.IsNullOrWhiteSpace(value)) return true;
        return Enum.TryParse(value.Replace("-", "").Replace(" ", ""), true, out frequency);
    }
}
