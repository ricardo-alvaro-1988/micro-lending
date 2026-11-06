namespace MicroLending.Api.Models;

/// <summary>
/// Users notified when a loan reaches Approved-Final and must create the payment schedule.
/// </summary>
public class PaymentScheduleAssignee
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
