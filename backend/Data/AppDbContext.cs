using MicroLending.Api.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, string>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AppPage> AppPages => Set<AppPage>();
    public DbSet<ProcessFlow> ProcessFlows => Set<ProcessFlow>();
    public DbSet<ProcessStage> ProcessStages => Set<ProcessStage>();
    public DbSet<ProcessStageApproverRole> ProcessStageApproverRoles => Set<ProcessStageApproverRole>();
    public DbSet<ProcessStageApproverUser> ProcessStageApproverUsers => Set<ProcessStageApproverUser>();
    public DbSet<CustomerGroup> CustomerGroups => Set<CustomerGroup>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerDocument> CustomerDocuments => Set<CustomerDocument>();
    public DbSet<LoanProduct> LoanProducts => Set<LoanProduct>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<LoanScheduleItem> LoanScheduleItems => Set<LoanScheduleItem>();
    public DbSet<LoanPayment> LoanPayments => Set<LoanPayment>();
    public DbSet<LoanApproval> LoanApprovals => Set<LoanApproval>();
    public DbSet<LoanActivity> LoanActivities => Set<LoanActivity>();
    public DbSet<LoanFieldNote> LoanFieldNotes => Set<LoanFieldNote>();
    public DbSet<LoanFieldNoteAttachment> LoanFieldNoteAttachments => Set<LoanFieldNoteAttachment>();
    public DbSet<PaymentScheduleAssignee> PaymentScheduleAssignees => Set<PaymentScheduleAssignee>();
    public DbSet<LateFeeSettings> LateFeeSettings => Set<LateFeeSettings>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<CashRemittance> CashRemittances => Set<CashRemittance>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Permission>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(100);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Module).HasMaxLength(100);
        });

        builder.Entity<RolePermission>(e =>
        {
            e.HasKey(x => new { x.RoleId, x.PermissionId });
            e.HasOne(x => x.Role).WithMany(r => r.RolePermissions).HasForeignKey(x => x.RoleId);
            e.HasOne(x => x.Permission).WithMany(p => p.RolePermissions).HasForeignKey(x => x.PermissionId);
        });

        builder.Entity<AppPage>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(100);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Path).HasMaxLength(200);
            e.Property(x => x.GroupName).HasMaxLength(100);
            e.HasOne(x => x.Permission).WithMany(p => p.Pages).HasForeignKey(x => x.PermissionId);
        });

        builder.Entity<ApplicationUser>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(200);
            e.HasIndex(x => x.IsDeleted);
            e.HasOne(x => x.Branch).WithMany(b => b.Users).HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<ProcessFlow>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.HasMany(x => x.Stages).WithOne(s => s.Flow).HasForeignKey(s => s.FlowId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProcessStage>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.HasOne(x => x.ApproverRole).WithMany().HasForeignKey(x => x.ApproverRoleId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.ApproverUser).WithMany().HasForeignKey(x => x.ApproverUserId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.OnApproveStage).WithMany().HasForeignKey(x => x.OnApproveStageId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.OnDeclineStage).WithMany().HasForeignKey(x => x.OnDeclineStageId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(x => new { x.FlowId, x.SortOrder });
        });

        builder.Entity<ProcessStageApproverRole>(e =>
        {
            e.HasKey(x => new { x.StageId, x.RoleId });
            e.HasOne(x => x.Stage).WithMany(s => s.ApproverRoles).HasForeignKey(x => x.StageId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Role).WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProcessStageApproverUser>(e =>
        {
            e.HasKey(x => new { x.StageId, x.UserId });
            e.HasOne(x => x.Stage).WithMany(s => s.ApproverUsers).HasForeignKey(x => x.StageId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<CustomerGroup>(e =>
        {
            e.ToTable("Groups");
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.HasIndex(x => x.Name).IsUnique();
        });

        builder.Entity<Branch>(e =>
        {
            e.ToTable("Branches");
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Code).HasMaxLength(50);
            e.Property(x => x.Address).HasMaxLength(300);
            e.Property(x => x.Barangay).HasMaxLength(150);
            e.Property(x => x.City).HasMaxLength(150);
            e.Property(x => x.Province).HasMaxLength(150);
            e.Property(x => x.ZipCode).HasMaxLength(20);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Email).HasMaxLength(200);
            e.HasIndex(x => x.Name).IsUnique();
            e.HasIndex(x => x.Code).IsUnique().HasFilter("[Code] IS NOT NULL");
        });

        builder.Entity<Customer>(e =>
        {
            e.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            e.Property(x => x.MiddleName).HasMaxLength(100);
            e.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            e.Property(x => x.FullName).HasMaxLength(300).IsRequired();
            e.Property(x => x.HouseUnit).HasMaxLength(100);
            e.Property(x => x.Street).HasMaxLength(200);
            e.Property(x => x.Barangay).HasMaxLength(150);
            e.Property(x => x.City).HasMaxLength(150);
            e.Property(x => x.Province).HasMaxLength(150);
            e.Property(x => x.ZipCode).HasMaxLength(20);
            e.Property(x => x.Mobile).HasMaxLength(50);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.ReferredBy).HasMaxLength(200);
            e.Property(x => x.IdType).HasMaxLength(50);
            e.Property(x => x.IdNumber).HasMaxLength(100);
            e.Property(x => x.CoMakerName).HasMaxLength(200);
            e.Property(x => x.CoMakerMobile).HasMaxLength(50);
            e.Property(x => x.CoMakerIdNumber).HasMaxLength(100);
            e.Property(x => x.GuarantorName).HasMaxLength(200);
            e.Property(x => x.GuarantorMobile).HasMaxLength(50);
            e.Property(x => x.GuarantorIdNumber).HasMaxLength(100);
            e.Property(x => x.Latitude).HasPrecision(9, 6);
            e.Property(x => x.Longitude).HasPrecision(9, 6);
            e.HasOne(x => x.Branch).WithMany(b => b.Customers).HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Group).WithMany(g => g.Customers).HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Agent1).WithMany().HasForeignKey(x => x.Agent1UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Agent2).WithMany().HasForeignKey(x => x.Agent2UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Agent3).WithMany().HasForeignKey(x => x.Agent3UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Documents).WithOne(d => d.Customer).HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<CustomerDocument>(e =>
        {
            e.Property(x => x.Label).HasMaxLength(200).IsRequired();
            e.Property(x => x.OriginalFileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.StoredFileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(150).IsRequired();
        });

        builder.Entity<LoanProduct>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.InterestRatePercent).HasPrecision(18, 4);
            e.HasIndex(x => x.Name).IsUnique();
        });

        builder.Entity<Loan>(e =>
        {
            e.HasIndex(x => x.LoanNumber).IsUnique();
            e.Property(x => x.LoanNumber).HasMaxLength(50);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.InterestRatePercent).HasPrecision(18, 4);
            e.Property(x => x.InterestAmount).HasPrecision(18, 2);
            e.Property(x => x.TotalPayable).HasPrecision(18, 2);
            e.Property(x => x.InstallmentAmount).HasPrecision(18, 2);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasOne(x => x.Customer).WithMany(c => c.Loans).HasForeignKey(x => x.CustomerId);
            e.HasOne(x => x.Flow).WithMany().HasForeignKey(x => x.FlowId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CurrentStage).WithMany().HasForeignKey(x => x.CurrentStageId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.LoanProduct).WithMany(p => p.Loans).HasForeignKey(x => x.LoanProductId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<LoanScheduleItem>(e =>
        {
            e.Property(x => x.AmountDue).HasPrecision(18, 2);
            e.Property(x => x.PrincipalPortion).HasPrecision(18, 2);
            e.Property(x => x.InterestPortion).HasPrecision(18, 2);
            e.Property(x => x.PenaltyAmount).HasPrecision(18, 2);
            e.Property(x => x.PaidAmount).HasPrecision(18, 2);
            e.HasIndex(x => new { x.LoanId, x.InstallmentNumber }).IsUnique();
            e.HasOne(x => x.Loan).WithMany(l => l.ScheduleItems).HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<LateFeeSettings>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Percent).HasPrecision(18, 4);
            e.Property(x => x.MaxPerInstallment).HasPrecision(18, 2);
        });

        builder.Entity<LoanPayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Method).HasMaxLength(100);
            e.Property(x => x.Reference).HasMaxLength(100);
            e.Property(x => x.Notes).HasMaxLength(500);
            e.HasOne(x => x.Loan).WithMany(l => l.Payments).HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.RecordedByUser).WithMany().HasForeignKey(x => x.RecordedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<LoanApproval>(e =>
        {
            e.Property(x => x.Comments).HasMaxLength(1000);
            e.HasOne(x => x.Loan).WithMany(l => l.Approvals).HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Stage).WithMany().HasForeignKey(x => x.StageId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DecidedByUser).WithMany().HasForeignKey(x => x.DecidedByUserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<LoanActivity>(e =>
        {
            e.Property(x => x.StageName).HasMaxLength(200).IsRequired();
            e.Property(x => x.ActorName).HasMaxLength(200);
            e.Property(x => x.Notes).HasMaxLength(500);
            e.HasIndex(x => new { x.LoanId, x.OccurredAt });
            e.HasOne(x => x.Loan).WithMany(l => l.Activities).HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Stage).WithMany().HasForeignKey(x => x.StageId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.ActorUser).WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<PaymentScheduleAssignee>(e =>
        {
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<LoanFieldNote>(e =>
        {
            e.Property(x => x.Body).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => new { x.LoanId, x.CreatedAt });
            e.HasOne(x => x.Loan).WithMany(l => l.FieldNotes).HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<LoanFieldNoteAttachment>(e =>
        {
            e.Property(x => x.OriginalFileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.StoredFileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(150).IsRequired();
            e.HasOne(x => x.Note).WithMany(n => n.Attachments).HasForeignKey(x => x.NoteId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AuditLog>(e =>
        {
            e.Property(x => x.ActorUserId).HasMaxLength(450);
            e.Property(x => x.ActorUserName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Action).HasMaxLength(50).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            e.Property(x => x.EntityId).HasMaxLength(100);
            e.Property(x => x.Summary).HasMaxLength(500).IsRequired();
            e.HasIndex(x => x.OccurredAt);
            e.HasIndex(x => new { x.EntityType, x.OccurredAt });
        });

        builder.Entity<CashRemittance>(e =>
        {
            e.Property(x => x.CollectedAmount).HasPrecision(18, 2);
            e.Property(x => x.RemittedAmount).HasPrecision(18, 2);
            e.Property(x => x.Variance).HasPrecision(18, 2);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasIndex(x => new { x.AgentUserId, x.RemittanceDate });
            e.HasIndex(x => x.Status);
            e.HasOne(x => x.AgentUser).WithMany().HasForeignKey(x => x.AgentUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ReceivedByUser).WithMany().HasForeignKey(x => x.ReceivedByUserId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
