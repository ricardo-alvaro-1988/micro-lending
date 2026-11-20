namespace MicroLending.Api.Services;

/// <summary>Business calendar for the lending app — always Asia/Manila (UTC+8).</summary>
public static class PhilippineTime
{
    /// <summary>Windows id is "Singapore Standard Time" (same offset as Manila, no DST).</summary>
    public static readonly TimeZoneInfo Zone = ResolveZone();

    public static DateTime UtcNow => DateTime.UtcNow;

    /// <summary>Current clock in the Philippines (Unspecified kind).</summary>
    public static DateTime Now =>
        DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone), DateTimeKind.Unspecified);

    /// <summary>Today's calendar date in the Philippines.</summary>
    public static DateTime Today => Now.Date;

    /// <summary>
    /// Normalize a client/business timestamp to Philippine local time for storage and day filters.
    /// Date-only values (midnight) keep that calendar day in PH; null uses PH now.
    /// </summary>
    public static DateTime Normalize(DateTime? value)
    {
        if (value is null) return Now;

        var dt = value.Value;
        if (dt.Kind == DateTimeKind.Utc)
            return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(dt, Zone), DateTimeKind.Unspecified);

        // Date-only from &lt;input type="date"&gt; — keep the chosen PH calendar day, stamp current PH time.
        if (dt.TimeOfDay == TimeSpan.Zero)
            return dt.Date.Add(Now.TimeOfDay);

        // Unspecified / Local: treat clock digits as already Philippine business time.
        return DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);
    }

    /// <summary>PH calendar date of a stored timestamp (handles legacy UTC rows).</summary>
    public static DateTime ToPhilippineDate(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc)
            return TimeZoneInfo.ConvertTimeFromUtc(value, Zone).Date;
        return value.Date;
    }

    /// <summary>Inclusive start / exclusive end for a PH calendar day, for filtering stored PaidAt values.</summary>
    public static (DateTime Start, DateTime EndExclusive) DayRange(DateTime businessDate)
    {
        var start = businessDate.Date;
        return (start, start.AddDays(1));
    }

    private static TimeZoneInfo ResolveZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(
                OperatingSystem.IsWindows() ? "Singapore Standard Time" : "Asia/Manila");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.CreateCustomTimeZone(
                "Asia/Manila",
                TimeSpan.FromHours(8),
                "Philippine Time",
                "Philippine Time");
        }
    }
}
