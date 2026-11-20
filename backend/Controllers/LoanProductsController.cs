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
[Route("api/loan-products")]
[Authorize]
public class LoanProductsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;

    public LoanProductsController(AppDbContext db, AuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanProductDto>>> GetAll([FromQuery] bool activeOnly = false)
    {
        var canView = User.HasClaim("permission", PermissionCodes.LoanProductsView);
        var canLoans = User.HasClaim("permission", PermissionCodes.LoansView)
            || User.HasClaim("permission", PermissionCodes.LoansManage);
        var canSchedule = User.HasClaim("permission", PermissionCodes.PaymentScheduleView)
            || User.HasClaim("permission", PermissionCodes.PaymentScheduleManage);
        var canCustomers = User.HasClaim("permission", PermissionCodes.CustomersView);
        if (!canView && !canLoans && !canSchedule && !canCustomers) return Forbid();

        var query = _db.LoanProducts.AsQueryable();
        if (activeOnly || !canView)
            query = query.Where(p => p.IsActive);

        var list = await query
            .Include(p => p.Loans)
            .OrderBy(p => p.Amount)
            .ThenBy(p => p.Name)
            .ToListAsync();

        return Ok(list.Select(p => Map(p, p.Loans.Count)).ToList());
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.LoanProductsView}")]
    public async Task<ActionResult<LoanProductDto>> Get(int id)
    {
        var product = await _db.LoanProducts
            .Include(p => p.Loans)
            .FirstOrDefaultAsync(p => p.Id == id);
        return product is null ? NotFound() : Ok(Map(product, product.Loans.Count));
    }

    [HttpPost]
    [Authorize(Policy = $"perm:{PermissionCodes.LoanProductsManage}")]
    public async Task<ActionResult<LoanProductDto>> Create([FromBody] UpsertLoanProductRequest request)
    {
        if (!TryParseTerms(request, out var frequency, out var method, out var error))
            return BadRequest(new { message = error });

        var name = request.Name.Trim();
        if (await _db.LoanProducts.AnyAsync(p => p.Name == name))
            return BadRequest(new { message = "A loan product with this name already exists." });

        var product = new LoanProduct();
        Apply(product, request, frequency, method);
        product.CreatedAt = DateTime.UtcNow;
        _db.LoanProducts.Add(product);
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "Created",
            "LoanProduct",
            product.Id.ToString(),
            $"Created loan product '{product.Name}'",
            new { product.Name, product.Amount, product.InterestRatePercent, product.TermCount, Frequency = product.PaymentFrequency.ToString(), Method = product.InterestMethod.ToString() });

        return Created($"/api/loan-products/{product.Id}", Map(product, 0));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.LoanProductsManage}")]
    public async Task<ActionResult<LoanProductDto>> Update(int id, [FromBody] UpsertLoanProductRequest request)
    {
        if (!TryParseTerms(request, out var frequency, out var method, out var error))
            return BadRequest(new { message = error });

        var product = await _db.LoanProducts.Include(p => p.Loans).FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound();

        var name = request.Name.Trim();
        if (await _db.LoanProducts.AnyAsync(p => p.Name == name && p.Id != id))
            return BadRequest(new { message = "A loan product with this name already exists." });

        Apply(product, request, frequency, method);
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "Updated",
            "LoanProduct",
            product.Id.ToString(),
            $"Updated loan product '{product.Name}'",
            new { product.Name, product.Amount, product.InterestRatePercent, product.TermCount, Frequency = product.PaymentFrequency.ToString(), Method = product.InterestMethod.ToString(), product.IsActive });

        return Ok(Map(product, product.Loans.Count));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = $"perm:{PermissionCodes.LoanProductsManage}")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _db.LoanProducts.Include(p => p.Loans).FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return NotFound();
        if (product.Loans.Count > 0)
            return BadRequest(new { message = "Cannot delete a product that is used by loans. Deactivate it instead." });

        var name = product.Name;
        _db.LoanProducts.Remove(product);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("Deleted", "LoanProduct", id.ToString(), $"Deleted loan product '{name}'");

        return NoContent();
    }

    private static bool TryParseTerms(
        UpsertLoanProductRequest request,
        out PaymentFrequency frequency,
        out InterestMethod method,
        out string? error)
    {
        frequency = PaymentFrequency.Daily;
        method = InterestMethod.Flat;
        error = null;

        if (string.IsNullOrWhiteSpace(request.PaymentFrequency)
            || !Enum.TryParse(request.PaymentFrequency.Replace("-", "").Replace(" ", ""), true, out frequency))
        {
            error = "Payment frequency must be Daily, Weekly, BiWeekly, or Monthly.";
            return false;
        }

        if (!LoanFinanceService.TryParseInterestMethod(request.InterestMethod, out method))
        {
            error = "Interest method must be Flat or DecliningBalance.";
            return false;
        }

        return true;
    }

    private static void Apply(
        LoanProduct product,
        UpsertLoanProductRequest request,
        PaymentFrequency frequency,
        InterestMethod method)
    {
        product.Name = request.Name.Trim();
        product.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        product.PaymentFrequency = frequency;
        product.InterestMethod = method;
        product.TermCount = request.TermCount;
        product.IsActive = request.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        if (request.ApplyFeeRules)
        {
            LoanFeeRules.ApplyComputedFees(product, request.Amount, request.TermCount);
            return;
        }

        product.Amount = LoanFeeRules.RoundToTens(request.Amount);
        product.InterestRatePercent = decimal.Round(request.InterestRatePercent, 4);
        product.InsuranceAmount = decimal.Round(request.InsuranceAmount, 2);
        product.InitialSavings = decimal.Round(request.InitialSavings, 2);
        product.SavingsPerPeriod = decimal.Round(request.SavingsPerPeriod, 2);
        product.InsurancePerPeriod = decimal.Round(request.InsurancePerPeriod, 2);
        product.MembershipFee = decimal.Round(request.MembershipFee, 2);
        product.ProcessingFee = decimal.Round(request.ProcessingFee, 2);
        product.LoanRedemptionFee = decimal.Round(request.LoanRedemptionFee, 2);
        product.Taxes = decimal.Round(request.Taxes, 2);
        product.NotarialFee = decimal.Round(request.NotarialFee, 2);
        product.Raffle = decimal.Round(request.Raffle, 2);
    }

    private static LoanProductDto Map(LoanProduct p, int loanCount) =>
        new(
            p.Id,
            p.Name,
            p.Description,
            p.Amount,
            p.InterestRatePercent,
            p.TermCount,
            p.PaymentFrequency.ToString(),
            p.InterestMethod.ToString(),
            p.InsuranceAmount,
            p.InitialSavings,
            p.SavingsPerPeriod,
            p.InsurancePerPeriod,
            p.MembershipFee,
            p.ProcessingFee,
            p.LoanRedemptionFee,
            p.Taxes,
            p.NotarialFee,
            p.Raffle,
            p.IsActive,
            loanCount,
            p.CreatedAt);
}
