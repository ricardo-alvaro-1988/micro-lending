namespace MicroLending.Api.Models;

public class ProcessFlow
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ProcessStage> Stages { get; set; } = new List<ProcessStage>();
}

public class ProcessStage
{
    public int Id { get; set; }
    public int FlowId { get; set; }
    public ProcessFlow Flow { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool RequiresApproval { get; set; }
    /// <summary>Legacy single role (migrated into ApproverRoles).</summary>
    public string? ApproverRoleId { get; set; }
    public ApplicationRole? ApproverRole { get; set; }
    /// <summary>Legacy single user (migrated into ApproverUsers).</summary>
    public string? ApproverUserId { get; set; }
    public ApplicationUser? ApproverUser { get; set; }
    public bool IsFinal { get; set; }

    /// <summary>Stage to enter after approve. Null = next by sort order (or close if none).</summary>
    public int? OnApproveStageId { get; set; }
    public ProcessStage? OnApproveStage { get; set; }

    /// <summary>Stage to enter after decline. Null = mark loan Rejected (end).</summary>
    public int? OnDeclineStageId { get; set; }
    public ProcessStage? OnDeclineStage { get; set; }

    public ICollection<ProcessStageApproverRole> ApproverRoles { get; set; } = new List<ProcessStageApproverRole>();
    public ICollection<ProcessStageApproverUser> ApproverUsers { get; set; } = new List<ProcessStageApproverUser>();
}

/// <summary>Many-to-many: stage may allow any user in these roles to approve.</summary>
public class ProcessStageApproverRole
{
    public int StageId { get; set; }
    public ProcessStage Stage { get; set; } = null!;
    public string RoleId { get; set; } = string.Empty;
    public ApplicationRole Role { get; set; } = null!;
}

/// <summary>Many-to-many: optional explicit approvers (usually users from the selected roles).</summary>
public class ProcessStageApproverUser
{
    public int StageId { get; set; }
    public ProcessStage Stage { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
}

public class CustomerGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Customer> Customers { get; set; } = new List<Customer>();
}

public class Branch
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Address { get; set; }
    public string? Barangay { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? ZipCode { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Customer> Customers { get; set; } = new List<Customer>();
    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();

    public string FormatAddress() =>
        string.Join(", ", new[] { Address, Barangay, City, Province, ZipCode }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim()));
}

public class Customer
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    /// <summary>Denormalized display name: First + Middle + Last.</summary>
    public string FullName { get; set; } = string.Empty;

    public int? BranchId { get; set; }
    public Branch? Branch { get; set; }

    public int? GroupId { get; set; }
    public CustomerGroup? Group { get; set; }

    /// <summary>Primary collection agent (required).</summary>
    public string? Agent1UserId { get; set; }
    public ApplicationUser? Agent1 { get; set; }
    /// <summary>Optional secondary collection agent.</summary>
    public string? Agent2UserId { get; set; }
    public ApplicationUser? Agent2 { get; set; }
    /// <summary>Optional tertiary collection agent.</summary>
    public string? Agent3UserId { get; set; }
    public ApplicationUser? Agent3 { get; set; }

    public string? HouseUnit { get; set; }
    public string? Street { get; set; }
    public string? Barangay { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? ZipCode { get; set; }

    public string? Mobile { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }

    public string? ReferredBy { get; set; }

    public DateTime? DateOfBirth { get; set; }
    public string? IdType { get; set; }
    public string? IdNumber { get; set; }
    public string? CoMakerName { get; set; }
    public string? CoMakerMobile { get; set; }
    public string? CoMakerIdNumber { get; set; }
    public string? GuarantorName { get; set; }
    public string? GuarantorMobile { get; set; }
    public string? GuarantorIdNumber { get; set; }

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    /// <summary>Optional profile photo stored under Uploads/customers/{id}.</summary>
    public string? ProfilePictureStoredFileName { get; set; }
    public string? ProfilePictureContentType { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Loan> Loans { get; set; } = new List<Loan>();
    public ICollection<CustomerDocument> Documents { get; set; } = new List<CustomerDocument>();

    public void RefreshFullName()
    {
        FullName = string.Join(" ", new[] { FirstName, MiddleName, LastName }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim()));
    }

    public string FormatAddress() =>
        string.Join(", ", new[] { HouseUnit, Street, Barangay, City, Province, ZipCode }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim()));
}

public class CustomerDocument
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string Label { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public enum LoanStatus
{
    InProgress = 0,
    PendingApproval = 1,
    Rejected = 2,
    /// <summary>Legacy / fully wound-down loans.</summary>
    Closed = 3,
    /// <summary>Fully approved through the process flow — ready for payment terms / schedule.</summary>
    ApprovedFinal = 4
}

public enum ApprovalDecision
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public enum PaymentFrequency
{
    Weekly = 0,
    BiWeekly = 1,
    Monthly = 2,
    Daily = 3
}

public enum ScheduleItemStatus
{
    Pending = 0,
    Partial = 1,
    Paid = 2,
    Overdue = 3
}

public class Loan
{
    public int Id { get; set; }
    public string LoanNumber { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int FlowId { get; set; }
    public ProcessFlow Flow { get; set; } = null!;
    public int CurrentStageId { get; set; }
    public ProcessStage CurrentStage { get; set; } = null!;
    /// <summary>Principal amount.</summary>
    public decimal Amount { get; set; }
    /// <summary>Interest rate (%). Flat = on principal over the term; DecliningBalance = per period on remaining principal.</summary>
    public decimal InterestRatePercent { get; set; }
    /// <summary>Number of installments.</summary>
    public int TermCount { get; set; }
    public PaymentFrequency PaymentFrequency { get; set; } = PaymentFrequency.Monthly;
    public InterestMethod InterestMethod { get; set; } = InterestMethod.Flat;
    public int? LoanProductId { get; set; }
    public LoanProduct? LoanProduct { get; set; }
    public DateTime? FirstDueDate { get; set; }
    public decimal InterestAmount { get; set; }
    public decimal TotalPayable { get; set; }
    public decimal InstallmentAmount { get; set; }
    public LoanStatus Status { get; set; } = LoanStatus.InProgress;
    public string CreatedByUserId { get; set; } = string.Empty;
    public ApplicationUser CreatedByUser { get; set; } = null!;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<LoanApproval> Approvals { get; set; } = new List<LoanApproval>();
    public ICollection<LoanScheduleItem> ScheduleItems { get; set; } = new List<LoanScheduleItem>();
    public ICollection<LoanPayment> Payments { get; set; } = new List<LoanPayment>();
    public ICollection<LoanActivity> Activities { get; set; } = new List<LoanActivity>();
    public ICollection<LoanFieldNote> FieldNotes { get; set; } = new List<LoanFieldNote>();
}

public class LoanScheduleItem
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public int InstallmentNumber { get; set; }
    public DateTime DueDate { get; set; }
    public decimal AmountDue { get; set; }
    public decimal PrincipalPortion { get; set; }
    public decimal InterestPortion { get; set; }
    /// <summary>Late fee accrued on this installment (recalculated from settings + days late).</summary>
    public decimal PenaltyAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public ScheduleItemStatus Status { get; set; } = ScheduleItemStatus.Pending;
}

public enum LateFeeType
{
    /// <summary>Fixed amount charged once after grace period.</summary>
    FlatOnce = 0,
    /// <summary>Fixed amount × days past grace.</summary>
    FlatPerDay = 1,
    /// <summary>(Percent of installment AmountDue / 100) × days past grace.</summary>
    PercentOfInstallmentPerDay = 2
}

/// <summary>Singleton late-fee / penalty rules (Id = 1).</summary>
public class LateFeeSettings
{
    public int Id { get; set; } = 1;
    public bool IsEnabled { get; set; }
    public LateFeeType Type { get; set; } = LateFeeType.FlatPerDay;
    /// <summary>Flat amount for FlatOnce / FlatPerDay.</summary>
    public decimal Amount { get; set; }
    /// <summary>Percent for PercentOfInstallmentPerDay (e.g. 1 = 1%/day).</summary>
    public decimal Percent { get; set; }
    /// <summary>Days after due date before fees start.</summary>
    public int GraceDays { get; set; }
    /// <summary>Optional cap per installment; null = no cap.</summary>
    public decimal? MaxPerInstallment { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class LoanPayment
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public decimal Amount { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public string? Method { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public string RecordedByUserId { get; set; } = string.Empty;
    public ApplicationUser RecordedByUser { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class LoanApproval
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public int StageId { get; set; }
    public ProcessStage Stage { get; set; } = null!;
    public ApprovalDecision Decision { get; set; } = ApprovalDecision.Pending;
    public string? DecidedByUserId { get; set; }
    public ApplicationUser? DecidedByUser { get; set; }
    public string? Comments { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedAt { get; set; }
}

public enum LoanActivityType
{
    ApplicationSubmitted = 0,
    StageEntered = 1,
    ApprovalRequested = 2,
    Approved = 3,
    Declined = 4,
    Advanced = 5,
    Closed = 6,
    Rejected = 7,
    ApprovedFinal = 8
}

/// <summary>Immutable process-flow trail for a loan (Activity page).</summary>
public class LoanActivity
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public LoanActivityType Type { get; set; }
    public int? StageId { get; set; }
    public ProcessStage? Stage { get; set; }
    public string StageName { get; set; } = string.Empty;
    public string? ActorUserId { get; set; }
    public ApplicationUser? ActorUser { get; set; }
    public string? ActorName { get; set; }
    public string? Notes { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
}
