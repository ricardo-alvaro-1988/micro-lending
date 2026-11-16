using MicroLending.Api.Dtos;
using MicroLending.Api.Models;

namespace MicroLending.Api.Services;

public static class CustomerMapping
{
    public static int? AgeYears(DateTime? dateOfBirth, DateTime? asOf = null)
    {
        if (dateOfBirth is null) return null;
        var today = (asOf ?? DateTime.UtcNow).Date;
        var dob = dateOfBirth.Value.Date;
        var age = today.Year - dob.Year;
        if (dob > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    public static CustomerDetailDto MapDetail(Customer c) =>
        new(
            c.Id,
            c.FirstName,
            c.MiddleName,
            c.LastName,
            c.NameExtension,
            c.FullName,
            c.BranchId,
            c.Branch?.Name,
            c.GroupId,
            c.Group?.Name,
            c.Agent1UserId,
            c.Agent1?.FullName,
            c.Agent2UserId,
            c.Agent2?.FullName,
            c.Agent3UserId,
            c.Agent3?.FullName,
            c.Sex,
            c.DateOfBirth,
            AgeYears(c.DateOfBirth),
            c.PlaceOfBirth,
            c.CivilStatus,
            c.HouseUnit,
            c.Street,
            c.Barangay,
            c.City,
            c.Province,
            c.ZipCode,
            c.YearsAtPresentAddress,
            c.PresentHousingStatus,
            FormatAddress(c.HouseUnit, c.Street, c.Barangay, c.City, c.Province, c.ZipCode),
            c.PreviousHouseUnit,
            c.PreviousStreet,
            c.PreviousBarangay,
            c.PreviousCity,
            c.PreviousProvince,
            c.YearsAtPreviousAddress,
            c.PreviousHousingStatus,
            c.EmployerOrBusinessName,
            c.OccupationOrPosition,
            c.EmployerOrBusinessAddress,
            c.EmployerContactNumber,
            c.NetIncomePerMonth,
            c.IncomeVia,
            c.Mobile,
            c.Phone,
            c.Email,
            c.ReferredBy,
            c.IdType,
            c.IdNumber,
            c.SpouseName,
            c.CoMakerName,
            c.CoMakerMobile,
            c.CoMakerIdNumber,
            c.GuarantorName,
            c.GuarantorMobile,
            c.GuarantorIdNumber,
            c.AuthorizationRemarks,
            c.Latitude,
            c.Longitude,
            c.CreatedAt,
            !string.IsNullOrWhiteSpace(c.ProfilePictureStoredFileName),
            c.Documents
                .OrderByDescending(d => d.UploadedAt)
                .Select(d => new CustomerDocumentDto(
                    d.Id, d.Label, d.OriginalFileName, d.ContentType, d.SizeBytes, d.UploadedAt))
                .ToList());

    public static void Apply(Customer customer, UpsertCustomerRequest request)
    {
        customer.FirstName = request.FirstName.Trim();
        customer.MiddleName = TrimOrNull(request.MiddleName);
        customer.LastName = request.LastName.Trim();
        customer.NameExtension = TrimOrNull(request.NameExtension);
        customer.RefreshFullName();
        customer.BranchId = request.BranchId;
        customer.GroupId = request.GroupId;
        customer.Agent1UserId = TrimOrNull(request.Agent1UserId)!;
        customer.Agent2UserId = TrimOrNull(request.Agent2UserId);
        customer.Agent3UserId = TrimOrNull(request.Agent3UserId);
        customer.Sex = NormalizeSex(request.Sex);
        customer.DateOfBirth = request.DateOfBirth;
        customer.PlaceOfBirth = TrimOrNull(request.PlaceOfBirth);
        customer.CivilStatus = TrimOrNull(request.CivilStatus);
        customer.HouseUnit = TrimOrNull(request.HouseUnit);
        customer.Street = TrimOrNull(request.Street);
        customer.Barangay = TrimOrNull(request.Barangay);
        customer.City = TrimOrNull(request.City);
        customer.Province = TrimOrNull(request.Province);
        customer.ZipCode = TrimOrNull(request.ZipCode);
        customer.YearsAtPresentAddress = request.YearsAtPresentAddress;
        customer.PresentHousingStatus = NormalizeHousing(request.PresentHousingStatus);
        customer.PreviousHouseUnit = TrimOrNull(request.PreviousHouseUnit);
        customer.PreviousStreet = TrimOrNull(request.PreviousStreet);
        customer.PreviousBarangay = TrimOrNull(request.PreviousBarangay);
        customer.PreviousCity = TrimOrNull(request.PreviousCity);
        customer.PreviousProvince = TrimOrNull(request.PreviousProvince);
        customer.YearsAtPreviousAddress = request.YearsAtPreviousAddress;
        customer.PreviousHousingStatus = NormalizeHousing(request.PreviousHousingStatus);
        customer.EmployerOrBusinessName = TrimOrNull(request.EmployerOrBusinessName);
        customer.OccupationOrPosition = TrimOrNull(request.OccupationOrPosition);
        customer.EmployerOrBusinessAddress = TrimOrNull(request.EmployerOrBusinessAddress);
        customer.EmployerContactNumber = TrimOrNull(request.EmployerContactNumber);
        customer.NetIncomePerMonth = request.NetIncomePerMonth;
        customer.IncomeVia = TrimOrNull(request.IncomeVia);
        customer.Mobile = TrimOrNull(request.Mobile);
        customer.Phone = TrimOrNull(request.Phone);
        customer.Email = TrimOrNull(request.Email);
        customer.ReferredBy = TrimOrNull(request.ReferredBy);
        customer.IdType = TrimOrNull(request.IdType);
        customer.IdNumber = TrimOrNull(request.IdNumber);
        customer.SpouseName = TrimOrNull(request.SpouseName);
        customer.CoMakerName = TrimOrNull(request.CoMakerName);
        customer.CoMakerMobile = TrimOrNull(request.CoMakerMobile);
        customer.CoMakerIdNumber = TrimOrNull(request.CoMakerIdNumber);
        customer.GuarantorName = TrimOrNull(request.GuarantorName);
        customer.GuarantorMobile = TrimOrNull(request.GuarantorMobile);
        customer.GuarantorIdNumber = TrimOrNull(request.GuarantorIdNumber);
        customer.AuthorizationRemarks = TrimOrNull(request.AuthorizationRemarks);
        customer.Latitude = request.Latitude;
        customer.Longitude = request.Longitude;
        customer.UpdatedAt = DateTime.UtcNow;
    }

    public static IReadOnlyList<LoanCollateralDto> MapCollaterals(IEnumerable<LoanCollateral> items) =>
        items
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .Select(c => new LoanCollateralDto(
                c.Id,
                c.DescriptionOrKind,
                c.Brand,
                c.EstimatedMarketValue,
                c.SortOrder))
            .ToList();

    public static void ReplaceCollaterals(Loan loan, IEnumerable<LoanCollateralInput>? inputs)
    {
        loan.Collaterals.Clear();
        if (inputs is null) return;
        var order = 0;
        foreach (var input in inputs)
        {
            if (string.IsNullOrWhiteSpace(input.DescriptionOrKind) && input.EstimatedMarketValue <= 0)
                continue;
            loan.Collaterals.Add(new LoanCollateral
            {
                DescriptionOrKind = input.DescriptionOrKind.Trim(),
                Brand = TrimOrNull(input.Brand),
                EstimatedMarketValue = decimal.Round(input.EstimatedMarketValue, 2),
                SortOrder = order++,
            });
        }
    }

    public static string? NormalizeLoanType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        if (v.Equals("Providential", StringComparison.OrdinalIgnoreCase) ||
            v.Equals("ProvidentialLoan", StringComparison.OrdinalIgnoreCase))
            return "Providential";
        if (v.Equals("Business", StringComparison.OrdinalIgnoreCase) ||
            v.Equals("BusinessLoan", StringComparison.OrdinalIgnoreCase))
            return "Business";
        return v;
    }

    public static string? NormalizeApplicationType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        if (v.Equals("New", StringComparison.OrdinalIgnoreCase)) return "New";
        if (v.Equals("Renewal", StringComparison.OrdinalIgnoreCase)) return "Renewal";
        if (v.Equals("Restructured", StringComparison.OrdinalIgnoreCase)) return "Restructured";
        return v;
    }

    private static string? NormalizeSex(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim().ToUpperInvariant();
        if (v is "F" or "FEMALE") return "F";
        if (v is "M" or "MALE") return "M";
        return v.Length == 1 ? v : null;
    }

    private static string? NormalizeHousing(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        if (v.Equals("Own", StringComparison.OrdinalIgnoreCase) || v.Equals("Owned", StringComparison.OrdinalIgnoreCase))
            return "Own";
        if (v.Equals("Rented", StringComparison.OrdinalIgnoreCase) || v.Equals("Rent", StringComparison.OrdinalIgnoreCase))
            return "Rented";
        return v;
    }

    private static string? TrimOrNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string FormatAddress(params string?[] parts) =>
        string.Join(", ", parts.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()));
}
