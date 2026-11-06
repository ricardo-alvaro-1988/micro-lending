using System.ComponentModel.DataAnnotations;

namespace MicroLending.Api.Dtos;

public record ProcessStageDto(
    int Id,
    string Name,
    int SortOrder,
    bool RequiresApproval,
    string? ApproverRoleId,
    string? ApproverRoleName,
    string? ApproverUserId,
    string? ApproverUserName,
    bool IsFinal,
    int? OnApproveStageId,
    int? OnApproveSortOrder,
    string? OnApproveStageName,
    int? OnDeclineStageId,
    int? OnDeclineSortOrder,
    string? OnDeclineStageName,
    bool OnDeclineEndsLoan);

public record ProcessFlowDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    IReadOnlyList<ProcessStageDto> Stages);

public class CreateProcessFlowRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(500)]
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateProcessFlowRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(500)]
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpsertStageRequest
{
    public int? Id { get; set; }
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool RequiresApproval { get; set; }
    public string? ApproverRoleId { get; set; }
    public string? ApproverUserId { get; set; }
    public bool IsFinal { get; set; }
    /// <summary>Target stage sort order after approve. Null = next stage.</summary>
    public int? OnApproveSortOrder { get; set; }
    /// <summary>Target stage sort order after decline. Ignored when OnDeclineEndsLoan is true.</summary>
    public int? OnDeclineSortOrder { get; set; }
    /// <summary>If true, decline ends the loan as Rejected.</summary>
    public bool OnDeclineEndsLoan { get; set; } = true;
}

public class ReplaceStagesRequest
{
    public List<UpsertStageRequest> Stages { get; set; } = [];
}

public record CustomerGroupDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    int CustomerCount,
    DateTime CreatedAt);

public class UpsertCustomerGroupRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(500)]
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public record BranchDto(
    int Id,
    string Name,
    string? Code,
    string? Address,
    string? Barangay,
    string? City,
    string? Province,
    string? ZipCode,
    string? Phone,
    string? Email,
    string AddressDisplay,
    bool IsActive,
    int CustomerCount,
    int UserCount,
    DateTime CreatedAt);

public class UpsertBranchRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(50)]
    public string? Code { get; set; }
    [MaxLength(300)]
    public string? Address { get; set; }
    [MaxLength(150)]
    public string? Barangay { get; set; }
    [MaxLength(150)]
    public string? City { get; set; }
    [MaxLength(150)]
    public string? Province { get; set; }
    [MaxLength(20)]
    public string? ZipCode { get; set; }
    [MaxLength(50)]
    public string? Phone { get; set; }
    [MaxLength(200)]
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
}

public record CustomerListItemDto(
    int Id,
    string FirstName,
    string? MiddleName,
    string LastName,
    string FullName,
    int? BranchId,
    string? BranchName,
    int? GroupId,
    string? GroupName,
    string? Agent1UserId,
    string? Agent1Name,
    string? Mobile,
    string? Email,
    string? City,
    string? ReferredBy,
    int DocumentCount,
    DateTime CreatedAt);

public record CustomerDocumentDto(
    int Id,
    string Label,
    string OriginalFileName,
    string ContentType,
    long SizeBytes,
    DateTime UploadedAt);

public record CustomerDetailDto(
    int Id,
    string FirstName,
    string? MiddleName,
    string LastName,
    string FullName,
    int? BranchId,
    string? BranchName,
    int? GroupId,
    string? GroupName,
    string? Agent1UserId,
    string? Agent1Name,
    string? Agent2UserId,
    string? Agent2Name,
    string? Agent3UserId,
    string? Agent3Name,
    string? HouseUnit,
    string? Street,
    string? Barangay,
    string? City,
    string? Province,
    string? ZipCode,
    string AddressDisplay,
    string? Mobile,
    string? Phone,
    string? Email,
    string? ReferredBy,
    DateTime? DateOfBirth,
    string? IdType,
    string? IdNumber,
    string? CoMakerName,
    string? CoMakerMobile,
    string? CoMakerIdNumber,
    string? GuarantorName,
    string? GuarantorMobile,
    string? GuarantorIdNumber,
    decimal? Latitude,
    decimal? Longitude,
    DateTime CreatedAt,
    IReadOnlyList<CustomerDocumentDto> Documents);

public class UpsertCustomerRequest
{
    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;
    [MaxLength(100)]
    public string? MiddleName { get; set; }
    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    public int? BranchId { get; set; }
    public int? GroupId { get; set; }

    [Required]
    public string Agent1UserId { get; set; } = string.Empty;
    public string? Agent2UserId { get; set; }
    public string? Agent3UserId { get; set; }

    [MaxLength(100)]
    public string? HouseUnit { get; set; }
    [MaxLength(200)]
    public string? Street { get; set; }
    [MaxLength(150)]
    public string? Barangay { get; set; }
    [MaxLength(150)]
    public string? City { get; set; }
    [MaxLength(150)]
    public string? Province { get; set; }
    [MaxLength(20)]
    public string? ZipCode { get; set; }

    [MaxLength(50)]
    public string? Mobile { get; set; }
    [MaxLength(50)]
    public string? Phone { get; set; }
    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? ReferredBy { get; set; }

    public DateTime? DateOfBirth { get; set; }
    [MaxLength(50)]
    public string? IdType { get; set; }
    [MaxLength(100)]
    public string? IdNumber { get; set; }
    [MaxLength(200)]
    public string? CoMakerName { get; set; }
    [MaxLength(50)]
    public string? CoMakerMobile { get; set; }
    [MaxLength(100)]
    public string? CoMakerIdNumber { get; set; }
    [MaxLength(200)]
    public string? GuarantorName { get; set; }
    [MaxLength(50)]
    public string? GuarantorMobile { get; set; }
    [MaxLength(100)]
    public string? GuarantorIdNumber { get; set; }

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public record AgentOptionDto(string Id, string FullName, string Email);

public record LoanDto(
    int Id,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    int FlowId,
    string FlowName,
    int CurrentStageId,
    string CurrentStageName,
    decimal Amount,
    decimal InterestRatePercent,
    int TermCount,
    string PaymentFrequency,
    DateTime? FirstDueDate,
    decimal InterestAmount,
    decimal TotalPayable,
    decimal InstallmentAmount,
    decimal TotalPaid,
    decimal RemainingBalance,
    string Status,
    string CreatedBy,
    string? Notes,
    DateTime CreatedAt,
    bool CanApprove,
    bool CanAdvance,
    bool HasTerms,
    int? LoanProductId,
    string? LoanProductName,
    string InterestMethod);

public class CreateLoanRequest
{
    [Required]
    public int CustomerId { get; set; }
    [Required]
    public int FlowId { get; set; }
    [Range(0.01, double.MaxValue)]
    public decimal Amount { get; set; }
    [Range(0, 1000)]
    public decimal InterestRatePercent { get; set; }
    [Range(0, 360)]
    public int TermCount { get; set; }
    public string? PaymentFrequency { get; set; }
    public DateTime? FirstDueDate { get; set; }
    public int? LoanProductId { get; set; }
    public string? InterestMethod { get; set; }
    [MaxLength(1000)]
    public string? Notes { get; set; }
}

public class UpdateLoanTermsRequest
{
    [Range(0.01, double.MaxValue)]
    public decimal Amount { get; set; }
    [Range(0, 1000)]
    public decimal InterestRatePercent { get; set; }
    [Range(1, 360)]
    public int TermCount { get; set; }
    [Required]
    public string PaymentFrequency { get; set; } = "Monthly";
    [Required]
    public DateTime FirstDueDate { get; set; }
    public int? LoanProductId { get; set; }
    public string? InterestMethod { get; set; }
    [MaxLength(1000)]
    public string? Notes { get; set; }
}

public record LoanProductDto(
    int Id,
    string Name,
    string? Description,
    decimal Amount,
    decimal InterestRatePercent,
    int TermCount,
    string PaymentFrequency,
    string InterestMethod,
    bool IsActive,
    int LoanCount,
    DateTime CreatedAt);

public class UpsertLoanProductRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(500)]
    public string? Description { get; set; }
    [Range(0.01, double.MaxValue)]
    public decimal Amount { get; set; }
    [Range(0, 1000)]
    public decimal InterestRatePercent { get; set; }
    [Range(1, 360)]
    public int TermCount { get; set; } = 12;
    [Required]
    public string PaymentFrequency { get; set; } = "Monthly";
    public string InterestMethod { get; set; } = "Flat";
    public bool IsActive { get; set; } = true;
}

public record LoanScheduleItemDto(
    int Id,
    int InstallmentNumber,
    DateTime DueDate,
    decimal AmountDue,
    decimal PrincipalPortion,
    decimal InterestPortion,
    decimal PenaltyAmount,
    decimal PaidAmount,
    decimal Balance,
    string Status);

public record LateFeeSettingsDto(
    bool IsEnabled,
    string Type,
    decimal Amount,
    decimal Percent,
    int GraceDays,
    decimal? MaxPerInstallment,
    DateTime UpdatedAt);

public class UpdateLateFeeSettingsRequest
{
    public bool IsEnabled { get; set; }
    [System.ComponentModel.DataAnnotations.Required]
    public string Type { get; set; } = "FlatPerDay";
    [System.ComponentModel.DataAnnotations.Range(0, double.MaxValue)]
    public decimal Amount { get; set; }
    [System.ComponentModel.DataAnnotations.Range(0, 100)]
    public decimal Percent { get; set; }
    [System.ComponentModel.DataAnnotations.Range(0, 365)]
    public int GraceDays { get; set; }
    [System.ComponentModel.DataAnnotations.Range(0, double.MaxValue)]
    public decimal? MaxPerInstallment { get; set; }
}

public record LoanPaymentDto(
    int Id,
    decimal Amount,
    DateTime PaidAt,
    string? Method,
    string? Reference,
    string? Notes,
    string RecordedBy,
    DateTime CreatedAt);

public class RecordLoanPaymentRequest
{
    [Range(0.01, double.MaxValue)]
    public decimal Amount { get; set; }
    public DateTime? PaidAt { get; set; }
    [MaxLength(100)]
    public string? Method { get; set; }
    [MaxLength(100)]
    public string? Reference { get; set; }
    [MaxLength(500)]
    public string? Notes { get; set; }
}

public record LoanApprovalHistoryDto(
    int Id,
    string StageName,
    string Decision,
    string? DecidedBy,
    string? Comments,
    DateTime RequestedAt,
    DateTime? DecidedAt);

public record CustomerPaymentSummaryDto(
    int CustomerId,
    string CustomerName,
    int LoanCount,
    decimal TotalPrincipal,
    decimal TotalPayable,
    decimal TotalPaid,
    decimal RemainingBalance,
    decimal OverdueAmount,
    int OverdueCount,
    IReadOnlyList<LoanDto> Loans);

public record StatementLineDto(
    DateTime Date,
    string Type,
    string Description,
    decimal Debit,
    decimal Credit,
    decimal Balance);

public record StatementOfAccountDto(
    int CustomerId,
    string CustomerName,
    int? LoanId,
    string? LoanNumber,
    DateTime GeneratedAt,
    decimal OpeningBalance,
    decimal ClosingBalance,
    IReadOnlyList<StatementLineDto> Lines);

public class ApprovalActionRequest
{
    [MaxLength(1000)]
    public string? Comments { get; set; }
}

public record ApprovalDto(
    int Id,
    int LoanId,
    string LoanNumber,
    string CustomerName,
    string StageName,
    decimal Amount,
    string Decision,
    DateTime RequestedAt,
    bool CanAct);

public record ApprovalNotificationSummaryDto(
    int Count,
    IReadOnlyList<ApprovalDto> Latest);

public record LoanActivityStepDto(
    int Id,
    string Type,
    string StageName,
    string? ActorName,
    string? Notes,
    DateTime OccurredAt);

public record LoanActivityTrailDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    decimal Amount,
    string FlowName,
    string CurrentStageName,
    string Status,
    DateTime CreatedAt,
    string CreatedBy,
    IReadOnlyList<LoanActivityStepDto> Steps);

public record PaymentScheduleAssigneeDto(
    string UserId,
    string FullName,
    string Email);

public class UpdatePaymentScheduleAssigneesRequest
{
    public List<string> UserIds { get; set; } = new();
}

public record PendingPaymentScheduleDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    decimal Amount,
    string FlowName,
    string CurrentStageName,
    string Status,
    DateTime ReadyAt,
    int WaitingHours,
    bool CanManage);

public record PaymentScheduleNotificationSummaryDto(
    int Count,
    bool IsAssignee,
    IReadOnlyList<PendingPaymentScheduleDto> Latest);

public record PendingLoanItemDto(
    int Id,
    string LoanNumber,
    string CustomerName,
    string CurrentStageName,
    decimal Amount,
    DateTime UpdatedAt);

public record PendingLoanSummaryDto(
    int Count,
    IReadOnlyList<PendingLoanItemDto> Latest);

public record FieldDuePaymentDto(
    int ScheduleItemId,
    int CustomerId,
    string CustomerName,
    string? CustomerMobile,
    int LoanId,
    string LoanNumber,
    int InstallmentNumber,
    DateTime DueDate,
    decimal AmountDue,
    decimal PenaltyAmount,
    decimal PaidAmount,
    decimal Remaining,
    bool IsOverdue,
    string LoanStatus);

public record LoanFieldNoteAttachmentDto(
    int Id,
    string OriginalFileName,
    string ContentType,
    long SizeBytes,
    DateTime UploadedAt,
    string DownloadUrl);

public record LoanFieldNoteDto(
    int Id,
    int LoanId,
    string Body,
    string CreatedBy,
    string CreatedByUserId,
    DateTime CreatedAt,
    IReadOnlyList<LoanFieldNoteAttachmentDto> Attachments);

public class CreateLoanFieldNoteRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(2000)]
    public string Body { get; set; } = string.Empty;
}

public record ReportDueCollectionDto(
    int ScheduleItemId,
    int CustomerId,
    string CustomerName,
    string? CustomerMobile,
    int? GroupId,
    string? GroupName,
    string? Agent1UserId,
    string? Agent1Name,
    int LoanId,
    string LoanNumber,
    int InstallmentNumber,
    DateTime DueDate,
    decimal AmountDue,
    decimal PenaltyAmount,
    decimal PaidAmount,
    decimal Remaining,
    bool IsOverdue,
    string LoanStatus);

public record ReportAgingRowDto(
    int ScheduleItemId,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    string? GroupName,
    int LoanId,
    string LoanNumber,
    int InstallmentNumber,
    DateTime DueDate,
    int DaysPastDue,
    string AgingBucket,
    decimal AmountDue,
    decimal PaidAmount,
    decimal Remaining);

public record ReportAgingSummaryDto(
    string Bucket,
    int Count,
    decimal RemainingTotal);

public record ReportAgingResultDto(
    DateTime AsOf,
    IReadOnlyList<ReportAgingSummaryDto> Summary,
    IReadOnlyList<ReportAgingRowDto> Rows);

public record ReportAgentCollectionDto(
    string? Agent1UserId,
    string Agent1Name,
    int CustomerCount,
    int LoanCount,
    decimal ExpectedDue,
    decimal Collected,
    decimal Variance);

public record ReportPaymentRegisterDto(
    int PaymentId,
    DateTime PaidAt,
    decimal Amount,
    string? Method,
    string? Reference,
    string RecordedBy,
    string? RecordedByUserId,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    int LoanId,
    string LoanNumber,
    int? BranchId,
    string? BranchName);

public record ReportPortfolioLoanDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    string? GroupName,
    int? BranchId,
    string? BranchName,
    string Status,
    decimal TotalPayable,
    decimal TotalPaid,
    decimal Remaining,
    decimal OverdueRemaining,
    int OverdueInstallments);

public record ReportPortfolioSummaryDto(
    DateTime AsOf,
    int ActiveLoanCount,
    decimal TotalPayable,
    decimal TotalPaid,
    decimal Outstanding,
    decimal OverdueTotal,
    int OverdueLoanCount,
    IReadOnlyList<ReportPortfolioLoanDto> Loans);

public record ReportLoanReleaseDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    string? GroupName,
    int? BranchId,
    string? BranchName,
    DateTime ReleasedAt,
    decimal Amount,
    decimal TotalPayable,
    string Status);

public record ReportExpectedActualDayDto(
    DateTime Date,
    decimal ExpectedDue,
    decimal Collected,
    decimal Variance);

public record ReportExpectedActualResultDto(
    DateTime From,
    DateTime To,
    decimal ExpectedDue,
    decimal Collected,
    decimal Variance,
    IReadOnlyList<ReportExpectedActualDayDto> Days);

public record ReportParLoanDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    string? GroupName,
    decimal Outstanding,
    int MaxDaysPastDue,
    bool InPar1,
    bool InPar7,
    bool InPar30);

public record ReportParResultDto(
    DateTime AsOf,
    decimal PortfolioOutstanding,
    decimal Par1Outstanding,
    decimal Par7Outstanding,
    decimal Par30Outstanding,
    decimal Par1Percent,
    decimal Par7Percent,
    decimal Par30Percent,
    IReadOnlyList<ReportParLoanDto> Loans);

public record ReportClosedLoanDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    string? GroupName,
    string Status,
    DateTime ClosedAt,
    string CloseReason,
    decimal TotalPayable,
    decimal TotalPaid);

public record ReportStatementExportLineDto(
    int CustomerId,
    string CustomerName,
    int LoanId,
    string LoanNumber,
    DateTime Date,
    string Type,
    string Description,
    decimal Debit,
    decimal Credit,
    decimal Balance);

public record ReportInterestIncomeRowDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    decimal AccruedInterest,
    decimal CollectedInterest,
    decimal Variance);

public record ReportInterestIncomeResultDto(
    DateTime From,
    DateTime To,
    decimal AccruedInterest,
    decimal CollectedInterest,
    decimal Variance,
    IReadOnlyList<ReportInterestIncomeRowDto> Rows);

public record ReportApprovalTatRowDto(
    int ApprovalId,
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string StageName,
    string Decision,
    DateTime RequestedAt,
    DateTime? DecidedAt,
    double? HoursToDecision,
    string? DecidedBy,
    string? Comments);

public record ReportApprovalTatStageDto(
    string StageName,
    int DecidedCount,
    double? AvgHours,
    double? MedianHours);

public record ReportApprovalTatResultDto(
    DateTime From,
    DateTime To,
    int PendingCount,
    int DecidedCount,
    double? OverallAvgHours,
    IReadOnlyList<ReportApprovalTatStageDto> ByStage,
    IReadOnlyList<ReportApprovalTatRowDto> Rows);

public record ReportRejectedApplicationDto(
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    string? GroupName,
    string Status,
    DateTime RejectedAt,
    string? StageName,
    string? Comments,
    decimal Amount);

public record ReportCustomerAssignmentDto(
    int CustomerId,
    string CustomerName,
    string? Mobile,
    int? BranchId,
    string? BranchName,
    int? GroupId,
    string? GroupName,
    string? Agent1UserId,
    string? Agent1Name,
    string? Agent2Name,
    string? Agent3Name,
    int LoanCount,
    int ActiveLoanCount,
    DateTime CreatedAt);

public record ReportFieldNoteLogDto(
    int NoteId,
    int LoanId,
    string LoanNumber,
    int CustomerId,
    string CustomerName,
    string? Agent1Name,
    string Body,
    string CreatedBy,
    string CreatedByUserId,
    DateTime CreatedAt,
    int AttachmentCount);

public record ReportPaymentMethodDto(
    string Method,
    int PaymentCount,
    decimal TotalAmount);

public record ReportPaymentMethodResultDto(
    DateTime From,
    DateTime To,
    decimal GrandTotal,
    IReadOnlyList<ReportPaymentMethodDto> Methods);

public record AuditLogDto(
    long Id,
    DateTime OccurredAt,
    string? ActorUserId,
    string ActorUserName,
    string Action,
    string EntityType,
    string? EntityId,
    string Summary,
    string? DetailsJson);

public record CashRemittanceDto(
    int Id,
    string AgentUserId,
    string AgentName,
    int? BranchId,
    string? BranchName,
    DateTime RemittanceDate,
    decimal CollectedAmount,
    decimal RemittedAmount,
    decimal Variance,
    string? Notes,
    string Status,
    string CreatedByUserId,
    string CreatedByName,
    string? ReceivedByUserId,
    string? ReceivedByName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? ReceivedAt);

public class CreateCashRemittanceRequest
{
    [Required]
    public string AgentUserId { get; set; } = string.Empty;
    public DateTime RemittanceDate { get; set; }
    [Range(0, double.MaxValue)]
    public decimal RemittedAmount { get; set; }
    public int? BranchId { get; set; }
    [MaxLength(1000)]
    public string? Notes { get; set; }
}

public class UpdateCashRemittanceRequest
{
    [Range(0, double.MaxValue)]
    public decimal RemittedAmount { get; set; }
    [MaxLength(1000)]
    public string? Notes { get; set; }
}

public class ReceiveCashRemittanceRequest
{
    [Range(0, double.MaxValue)]
    public decimal? RemittedAmount { get; set; }
    [MaxLength(1000)]
    public string? Notes { get; set; }
}

public record DashboardKpiDto(
    DateTime AsOf,
    /// <summary>Remaining on installments due on asOf (not yet past).</summary>
    decimal DueToday,
    int DueTodayCount,
    /// <summary>Payments posted on asOf (all methods).</summary>
    decimal CollectedToday,
    int CollectedTodayCount,
    /// <summary>CollectedToday − DueToday.</summary>
    decimal CollectionVariance,
    /// <summary>Share of due collected today (capped display helper; 0 if due is 0).</summary>
    decimal CollectionRatePercent,
    /// <summary>Remaining on overdue installments (due before asOf).</summary>
    decimal OverdueTotal,
    int OverdueCount,
    int OverdueLoanCount,
    /// <summary>Payments with method Cash on asOf.</summary>
    decimal CashToday,
    int CashTodayCount,
    /// <summary>Non-cash payments on asOf.</summary>
    decimal NonCashToday,
    int ActiveLoanCount,
    decimal PortfolioOutstanding);

/// <summary>One day in the dashboard collections trend chart.</summary>
public record DashboardTrendPointDto(
    DateTime Date,
    decimal Due,
    decimal Collected,
    decimal Cash,
    decimal Variance);

public record DashboardTrendDto(
    DateTime From,
    DateTime To,
    IReadOnlyList<DashboardTrendPointDto> Points);
