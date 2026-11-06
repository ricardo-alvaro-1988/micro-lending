namespace MicroLending.Api.Models;

public enum CashRemittanceStatus
{
    Draft = 0,
    Submitted = 1,
    Received = 2,
    Discrepancy = 3
}

/// <summary>Agent cash float: collected in field vs remitted to office.</summary>
public class CashRemittance
{
    public int Id { get; set; }
    public string AgentUserId { get; set; } = string.Empty;
    public ApplicationUser AgentUser { get; set; } = null!;
    public int? BranchId { get; set; }
    public Branch? Branch { get; set; }
    /// <summary>Calendar date of the remittance (date portion only).</summary>
    public DateTime RemittanceDate { get; set; }
    /// <summary>Sum of payments recorded by the agent on RemittanceDate (auto-calc on create/update).</summary>
    public decimal CollectedAmount { get; set; }
    /// <summary>Amount the agent says they are turning in (or office confirms).</summary>
    public decimal RemittedAmount { get; set; }
    /// <summary>CollectedAmount − RemittedAmount (positive = short remittance / float held).</summary>
    public decimal Variance { get; set; }
    public string? Notes { get; set; }
    public CashRemittanceStatus Status { get; set; } = CashRemittanceStatus.Draft;
    public string CreatedByUserId { get; set; } = string.Empty;
    public ApplicationUser CreatedByUser { get; set; } = null!;
    public string? ReceivedByUserId { get; set; }
    public ApplicationUser? ReceivedByUser { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReceivedAt { get; set; }
}
