using MicroLending.Api.Models;
using MicroLending.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MicroLending.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

        await db.Database.MigrateAsync();

        var permissions = new (string Code, string Name, string Module)[]
        {
            ("dashboard.view", "View Dashboard", "Dashboard"),
            ("roles.view", "View Roles", "Accessibility"),
            ("roles.manage", "Manage Roles", "Accessibility"),
            ("pages.view", "View Page Accessibility", "Accessibility"),
            ("pages.manage", "Manage Page Accessibility", "Accessibility"),
            ("users.view", "View Users", "Accessibility"),
            ("users.manage", "Manage Users", "Accessibility"),
            ("profile.view", "View Profile", "Profile"),
            ("flows.view", "View Process Flows", "Lending"),
            ("flows.manage", "Manage Process Flows", "Lending"),
            ("loans.view", "View Loans", "Lending"),
            ("loans.manage", "Manage Loans", "Lending"),
            ("approvals.view", "View Approvals", "Lending"),
            ("approvals.manage", "Act on Approvals", "Lending"),
            ("customers.view", "View Customers", "Lending"),
            ("customers.manage", "Manage Customers", "Lending"),
            ("groups.view", "View Groups", "Settings"),
            ("groups.manage", "Manage Groups", "Settings"),
            ("branches.view", "View Branches", "Settings"),
            ("branches.manage", "Manage Branches", "Settings"),
            ("activity.view", "View Activity", "Transaction"),
            ("paymentSchedule.view", "View Payment Schedule", "Transaction"),
            ("paymentSchedule.manage", "Manage Payment Schedule", "Transaction"),
            ("paymentSchedule.settings", "Payment Schedule Assignees", "Settings"),
            ("field.collect", "Field Collections", "Field"),
            ("field.notes", "Field Notes", "Field"),
            ("reports.view", "View Reports", "Reports"),
            ("lateFees.settings", "Late Fee Settings", "Settings"),
            ("audit.view", "View Audit Log", "Settings"),
            ("remittance.view", "View Cash Remittances", "Transaction"),
            ("remittance.manage", "Manage Cash Remittances", "Transaction"),
            ("remittance.receive", "Receive Cash Remittances", "Transaction"),
            ("loanProducts.view", "View Loan Products", "Lending"),
            ("loanProducts.manage", "Manage Loan Products", "Lending"),
        };

        foreach (var (code, name, module) in permissions)
        {
            var existingPerm = await db.Permissions.FirstOrDefaultAsync(p => p.Code == code);
            if (existingPerm is null)
            {
                db.Permissions.Add(new Permission { Code = code, Name = name, Module = module });
            }
            else
            {
                existingPerm.Name = name;
                existingPerm.Module = module;
            }
        }
        await db.SaveChangesAsync();

        var permMap = await db.Permissions.ToDictionaryAsync(p => p.Code, p => p);

        var pages = new (string Code, string Name, string Path, string Group, int Order, string Perm)[]
        {
            ("dashboard", "Dashboard", "/dashboard", "Main", 1, "dashboard.view"),
            ("roles", "Roles", "/accessibility/roles", "Accessibility", 2, "roles.view"),
            ("page-accessibility", "Page Accessibility", "/accessibility/pages", "Accessibility", 3, "pages.view"),
            ("users", "Users", "/accessibility/users", "Accessibility", 4, "users.view"),
            ("customers", "Customers", "/transaction/customers", "Transaction", 5, "customers.view"),
            ("record-payment", "Record Payment", "/transaction/record-payment", "Transaction", 6, "loans.manage"),
            ("activity", "Activity", "/transaction/activity", "Transaction", 7, "activity.view"),
            ("payment-schedule", "Payment Schedule", "/transaction/payment-schedule", "Transaction", 8, "paymentSchedule.view"),
            ("loan-tutorial", "How to Apply a Loan", "/lending/how-to-apply", "Lending", 9, "dashboard.view"),
            ("process-flows", "Process Flows", "/lending/flows", "Lending", 10, "flows.view"),
            ("loan-products", "Loan Products", "/lending/products", "Lending", 11, "loanProducts.view"),
            ("loans", "Loans", "/lending/loans", "Lending", 12, "loans.view"),
            ("approvals", "Approvals", "/lending/approvals", "Lending", 13, "approvals.view"),
            ("groups", "Groups", "/settings/groups", "Settings", 11, "groups.view"),
            ("branches", "Branches", "/settings/branches", "Settings", 12, "branches.view"),
            ("payment-schedule-settings", "Payment Schedule Notify", "/settings/payment-schedule", "Settings", 13, "paymentSchedule.settings"),
            ("profile", "Profile", "/profile", "Main", 14, "profile.view"),
            ("field-due", "Field Due Payments", "/field", "Field", 15, "field.collect"),
            ("field-customers", "Field Customers", "/field/customers", "Field", 16, "customers.view"),
            ("reports", "Reports", "/reports", "Reports", 17, "reports.view"),
            ("reports-due", "Daily Due Collections", "/reports/due-collections", "Reports", 18, "reports.view"),
            ("reports-aging", "Delinquency Aging", "/reports/delinquency-aging", "Reports", 19, "reports.view"),
            ("reports-agent", "Agent Collections", "/reports/agent-collections", "Reports", 20, "reports.view"),
            ("reports-payments", "Payment Register", "/reports/payment-register", "Reports", 21, "reports.view"),
            ("reports-portfolio", "Portfolio Summary", "/reports/portfolio-summary", "Reports", 22, "reports.view"),
            ("reports-releases", "Loan Releases", "/reports/loan-releases", "Reports", 23, "reports.view"),
            ("reports-expected", "Expected vs Actual", "/reports/expected-vs-actual", "Reports", 24, "reports.view"),
            ("reports-par", "Portfolio at Risk", "/reports/par", "Reports", 25, "reports.view"),
            ("reports-closed", "Closed Loans", "/reports/closed-loans", "Reports", 26, "reports.view"),
            ("reports-group-sheet", "Group Collection Sheet", "/reports/group-collection-sheet", "Reports", 27, "reports.view"),
            ("reports-statements", "Statements Export", "/reports/statements", "Reports", 28, "reports.view"),
            ("reports-interest", "Interest Income", "/reports/interest-income", "Reports", 29, "reports.view"),
            ("reports-tat", "Approval TAT", "/reports/approval-tat", "Reports", 30, "reports.view"),
            ("reports-rejected", "Rejected Applications", "/reports/rejected-applications", "Reports", 31, "reports.view"),
            ("reports-assignments", "Customer Assignments", "/reports/customer-assignments", "Reports", 32, "reports.view"),
            ("reports-field-notes", "Field Notes Log", "/reports/field-notes-log", "Reports", 33, "reports.view"),
            ("reports-methods", "Payment Methods", "/reports/payment-methods", "Reports", 34, "reports.view"),
            ("late-fees", "Late Fees", "/settings/late-fees", "Settings", 35, "lateFees.settings"),
            ("audit-log", "Audit Log", "/settings/audit-log", "Settings", 36, "audit.view"),
            ("remittances", "Cash Remittances", "/transaction/remittances", "Transaction", 37, "remittance.view"),
        };

        foreach (var (code, name, path, group, order, perm) in pages)
        {
            var existingPage = await db.AppPages.FirstOrDefaultAsync(p => p.Code == code);
            if (existingPage is null)
            {
                db.AppPages.Add(new AppPage
                {
                    Code = code,
                    Name = name,
                    Path = path,
                    GroupName = group,
                    SortOrder = order,
                    PermissionId = permMap[perm].Id
                });
            }
            else
            {
                existingPage.Name = name;
                existingPage.Path = path;
                existingPage.GroupName = group;
                existingPage.SortOrder = order;
                existingPage.PermissionId = permMap[perm].Id;
            }
        }
        await db.SaveChangesAsync();

        const string adminRoleName = "Admin";
        if (!await roleManager.RoleExistsAsync(adminRoleName))
        {
            await roleManager.CreateAsync(new ApplicationRole
            {
                Name = adminRoleName,
                IsSystem = true,
                Description = "Full system access"
            });
        }

        var adminRole = await roleManager.FindByNameAsync(adminRoleName)
            ?? throw new InvalidOperationException("Admin role missing");

        var allPermIds = await db.Permissions.Select(p => p.Id).ToListAsync();
        var existing = await db.RolePermissions
            .Where(rp => rp.RoleId == adminRole.Id)
            .Select(rp => rp.PermissionId)
            .ToListAsync();

        foreach (var pid in allPermIds.Except(existing))
        {
            db.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = pid });
        }
        await db.SaveChangesAsync();

        const string adminEmail = "admin@micro.local";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                FirstName = "System",
                LastName = "Admin",
                FullName = "System Admin",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(admin, "Admin123!");
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
            }
        }

        if (!await userManager.IsInRoleAsync(admin, adminRoleName))
        {
            await userManager.AddToRoleAsync(admin, adminRoleName);
        }

        const string fieldAgentRoleName = "Field Agent";
        if (!await roleManager.RoleExistsAsync(fieldAgentRoleName))
        {
            await roleManager.CreateAsync(new ApplicationRole
            {
                Name = fieldAgentRoleName,
                IsSystem = true,
                Description = "Field / collection agents assigned to customers"
            });
        }

        var fieldAgentRole = await roleManager.FindByNameAsync(fieldAgentRoleName)
            ?? throw new InvalidOperationException("Field Agent role missing");

        // Field agents: collection workspace only (Agent-1 customers).
        var fieldAgentPermCodes = new[]
        {
            "dashboard.view",
            "profile.view",
            "customers.view",
            "loans.view",
            "field.collect",
            "field.notes",
        };
        var fieldAgentPermIds = await db.Permissions
            .Where(p => fieldAgentPermCodes.Contains(p.Code))
            .Select(p => p.Id)
            .ToListAsync();
        var existingFieldAgentPerms = await db.RolePermissions
            .Where(rp => rp.RoleId == fieldAgentRole.Id)
            .Select(rp => rp.PermissionId)
            .ToListAsync();
        foreach (var pid in fieldAgentPermIds.Except(existingFieldAgentPerms))
        {
            db.RolePermissions.Add(new RolePermission { RoleId = fieldAgentRole.Id, PermissionId = pid });
        }
        // Drop office-only approvals perms previously seeded for field agents.
        var removeCodes = new[] { "approvals.view", "approvals.manage" };
        var removeIds = await db.Permissions.Where(p => removeCodes.Contains(p.Code)).Select(p => p.Id).ToListAsync();
        var stale = await db.RolePermissions
            .Where(rp => rp.RoleId == fieldAgentRole.Id && removeIds.Contains(rp.PermissionId))
            .ToListAsync();
        if (stale.Count > 0)
        {
            db.RolePermissions.RemoveRange(stale);
        }
        await db.SaveChangesAsync();

        var seedAgents = new (string Email, string FullName, string Password)[]
        {
            ("agent1@micro.local", "Field Agent 1", "Agent123!"),
            ("agent2@micro.local", "Field Agent 2", "Agent123!"),
            ("agent3@micro.local", "Field Agent 3", "Agent123!"),
        };

        foreach (var (email, fullName, password) in seedAgents)
        {
            var agent = await userManager.FindByEmailAsync(email);
            if (agent is null)
            {
                var nameParts = fullName.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                agent = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    FirstName = nameParts.ElementAtOrDefault(0) ?? fullName,
                    LastName = nameParts.ElementAtOrDefault(1) ?? "Agent",
                    FullName = fullName,
                    EmailConfirmed = true
                };
                var createAgent = await userManager.CreateAsync(agent, password);
                if (!createAgent.Succeeded)
                {
                    throw new InvalidOperationException(string.Join("; ", createAgent.Errors.Select(e => e.Description)));
                }
            }

            if (!await userManager.IsInRoleAsync(agent, fieldAgentRoleName))
            {
                await userManager.AddToRoleAsync(agent, fieldAgentRoleName);
            }
        }

        if (!await db.CustomerGroups.AnyAsync())
        {
            db.CustomerGroups.AddRange(
                new CustomerGroup { Name = "Individual", Description = "Individual borrowers", IsActive = true },
                new CustomerGroup { Name = "SME", Description = "Small and medium enterprises", IsActive = true },
                new CustomerGroup { Name = "Employee", Description = "Company employees", IsActive = true });
            await db.SaveChangesAsync();
        }

        if (!await db.Branches.AnyAsync())
        {
            db.Branches.AddRange(
                new Branch
                {
                    Name = "Head Office",
                    Code = "HO",
                    Address = "100 Main Avenue",
                    City = "Manila",
                    Province = "Metro Manila",
                    ZipCode = "1000",
                    Phone = "+63 2 8000 0000",
                    IsActive = true,
                },
                new Branch
                {
                    Name = "Cebu Branch",
                    Code = "CEB",
                    Address = "45 Osmena Blvd",
                    City = "Cebu City",
                    Province = "Cebu",
                    ZipCode = "6000",
                    Phone = "+63 32 400 0000",
                    IsActive = true,
                });
            await db.SaveChangesAsync();
        }

        // Sample default flow if none exists
        if (!await db.ProcessFlows.AnyAsync())
        {
            var flow = new ProcessFlow
            {
                Name = "Standard Individual Loan",
                Description = "Application → Review → Manager approval → Disbursement → Approved-Final",
                IsActive = true
            };
            db.ProcessFlows.Add(flow);
            await db.SaveChangesAsync();

            var application = new ProcessStage { FlowId = flow.Id, Name = "Application", SortOrder = 1, RequiresApproval = false };
            var credit = new ProcessStage
            {
                FlowId = flow.Id,
                Name = "Credit Review",
                SortOrder = 2,
                RequiresApproval = true,
                ApproverRoles =
                [
                    new ProcessStageApproverRole { RoleId = adminRole.Id }
                ]
            };
            var manager = new ProcessStage
            {
                FlowId = flow.Id,
                Name = "Manager Approval",
                SortOrder = 3,
                RequiresApproval = true,
                ApproverRoles =
                [
                    new ProcessStageApproverRole { RoleId = adminRole.Id }
                ],
                ApproverUsers =
                [
                    new ProcessStageApproverUser { UserId = admin.Id }
                ]
            };
            var disbursement = new ProcessStage { FlowId = flow.Id, Name = "Disbursement", SortOrder = 4, RequiresApproval = false };
            var approvedFinal = new ProcessStage
            {
                FlowId = flow.Id,
                Name = "Approved-Final",
                SortOrder = 5,
                RequiresApproval = false,
                IsFinal = true
            };

            db.ProcessStages.AddRange(application, credit, manager, disbursement, approvedFinal);
            await db.SaveChangesAsync();

            // Decline from Credit Review / Manager Approval returns to Application
            credit.OnDeclineStageId = application.Id;
            manager.OnDeclineStageId = application.Id;
            await db.SaveChangesAsync();
        }

        // Migrate legacy single ApproverRoleId / ApproverUserId into many-to-many tables.
        var legacyStages = await db.ProcessStages
            .Include(s => s.ApproverRoles)
            .Include(s => s.ApproverUsers)
            .Where(s => s.ApproverRoleId != null || s.ApproverUserId != null)
            .ToListAsync();
        foreach (var stage in legacyStages)
        {
            if (stage.ApproverRoleId is not null
                && stage.ApproverRoles.All(r => r.RoleId != stage.ApproverRoleId))
            {
                stage.ApproverRoles.Add(new ProcessStageApproverRole { RoleId = stage.ApproverRoleId });
            }
            if (stage.ApproverUserId is not null
                && stage.ApproverUsers.All(u => u.UserId != stage.ApproverUserId))
            {
                stage.ApproverUsers.Add(new ProcessStageApproverUser { UserId = stage.ApproverUserId });
            }
            stage.ApproverRoleId = null;
            stage.ApproverUserId = null;
        }
        if (legacyStages.Count > 0)
            await db.SaveChangesAsync();

        // Every flow's last stage must be Approved-Final (ready for payment schedule).
        var allFlows = await db.ProcessFlows.Include(f => f.Stages).ToListAsync();
        foreach (var flow in allFlows)
        {
            var ordered = flow.Stages.OrderBy(s => s.SortOrder).ToList();
            for (var i = 0; i < ordered.Count; i++)
            {
                var isLast = i == ordered.Count - 1;
                ordered[i].IsFinal = isLast;
                if (!isLast) continue;
                ordered[i].Name = "Approved-Final";
                ordered[i].RequiresApproval = false;
                ordered[i].ApproverRoleId = null;
                ordered[i].ApproverUserId = null;
            }
        }
        await db.SaveChangesAsync();

        // Legacy: Closed at final stage but still collecting → treat as ApprovedFinal.
        // Fully paid Closed loans stay Closed (matured).
        var finalStageIds = await db.ProcessStages.Where(s => s.IsFinal).Select(s => s.Id).ToListAsync();
        var legacyClosedLoans = await db.Loans
            .Include(l => l.ScheduleItems)
            .Include(l => l.Payments)
            .Where(l => l.Status == LoanStatus.Closed && finalStageIds.Contains(l.CurrentStageId))
            .ToListAsync();
        var reopened = 0;
        foreach (var loan in legacyClosedLoans)
        {
            var scheduleRemaining = loan.ScheduleItems.Sum(s =>
                Math.Max(0, s.AmountDue + s.PenaltyAmount - s.PaidAmount));
            var fullyPaid = scheduleRemaining <= 0.009m && loan.TotalPayable > 0;
            if (fullyPaid) continue;
            loan.Status = LoanStatus.ApprovedFinal;
            reopened++;
        }
        if (reopened > 0)
            await db.SaveChangesAsync();

        // Backfill: ApprovedFinal loans that are already fully paid → Closed.
        var finance = scope.ServiceProvider.GetRequiredService<LoanFinanceService>();
        var matured = await finance.MatureFullyPaidLoansAsync();
        if (matured > 0)
            await db.SaveChangesAsync();

        // Demo overdue: loan 9 / 1009 installment 1 is otherwise due today (chargeableDays = 0).
        // Backdate once so FlatPerDay late fees produce a visible penalty on collections lists.
        var demoOverdue = await (
            from item in db.LoanScheduleItems
            join loan in db.Loans on item.LoanId equals loan.Id
            where item.InstallmentNumber == 1
                  && (loan.Id == 9 || loan.LoanNumber == "1009")
                  && loan.CustomerId == 9
            select item).FirstOrDefaultAsync();
        if (demoOverdue is not null && demoOverdue.DueDate.Date >= DateTime.UtcNow.Date)
        {
            demoOverdue.DueDate = DateTime.UtcNow.Date.AddDays(-3);
            await db.SaveChangesAsync();
        }

        if (!await db.LoanProducts.AnyAsync())
        {
            db.LoanProducts.AddRange(
                new LoanProduct
                {
                    Name = "Weekly 10,000 flat",
                    Description = "₱10,000 over 12 weeks, 10% flat",
                    Amount = 10000,
                    InterestRatePercent = 10,
                    TermCount = 12,
                    PaymentFrequency = PaymentFrequency.Weekly,
                    InterestMethod = InterestMethod.Flat,
                    IsActive = true,
                },
                new LoanProduct
                {
                    Name = "Monthly 25,000 declining",
                    Description = "₱25,000 over 12 months, 2% declining balance per period",
                    Amount = 25000,
                    InterestRatePercent = 2,
                    TermCount = 12,
                    PaymentFrequency = PaymentFrequency.Monthly,
                    InterestMethod = InterestMethod.DecliningBalance,
                    IsActive = true,
                });
            await db.SaveChangesAsync();
        }

        if (!await db.LateFeeSettings.AnyAsync(s => s.Id == 1))
        {
            db.LateFeeSettings.Add(new LateFeeSettings
            {
                Id = 1,
                IsEnabled = false,
                Type = LateFeeType.FlatPerDay,
                Amount = 10m,
                Percent = 1m,
                GraceDays = 0,
                UpdatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        // Backfill name parts for existing users created before profile fields existed.
        var usersNeedingNames = await db.Users
            .Where(u => (u.FirstName == null || u.FirstName == "") && u.FullName != "")
            .ToListAsync();
        foreach (var u in usersNeedingNames)
        {
            var parts = u.FullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) continue;
            u.FirstName = parts[0];
            u.LastName = parts.Length > 1 ? string.Join(' ', parts.Skip(1)) : parts[0];
            if (parts.Length > 2)
            {
                u.MiddleName = string.Join(' ', parts.Skip(1).Take(parts.Length - 2));
                u.LastName = parts[^1];
            }
        }
        if (usersNeedingNames.Count > 0)
            await db.SaveChangesAsync();
    }
}
