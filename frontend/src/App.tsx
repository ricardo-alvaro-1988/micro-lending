import { Navigate, Route, Routes } from 'react-router-dom'
import { homePathFor, isFieldAgent } from './auth/homePath'
import { RequireAuth } from './auth/RequireAuth'
import { useAuth } from './auth/AuthContext'
import { AppLayout } from './layout/AppLayout'
import { FieldAgentLayout } from './layout/FieldAgentLayout'
import { ActivityPage } from './pages/ActivityPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { RejectedLoansPage } from './pages/RejectedLoansPage'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { BranchesPage } from './pages/BranchesPage'
import { GroupsPage } from './pages/GroupsPage'
import { LoanProductsPage } from './pages/LoanProductsPage'
import { LoansPage } from './pages/LoansPage'
import { LoanTutorialPage } from './pages/LoanTutorialPage'
import { LoginPage } from './pages/LoginPage'
import { PageAccessibilityPage } from './pages/PageAccessibilityPage'
import { PaymentSchedulePage } from './pages/PaymentSchedulePage'
import { PaymentScheduleSettingsPage } from './pages/PaymentScheduleSettingsPage'
import { LateFeesSettingsPage } from './pages/LateFeesSettingsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { RecordPaymentPage } from './pages/RecordPaymentPage'
import { RemittancesPage } from './pages/RemittancesPage'
import { ProcessFlowsPage } from './pages/ProcessFlowsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RolesPage } from './pages/RolesPage'
import { UsersPage } from './pages/UsersPage'
import { FieldDuePage } from './pages/field/FieldDuePage'
import { FieldCustomersPage } from './pages/field/FieldCustomersPage'
import { FieldCustomerSheetPage } from './pages/field/FieldCustomerSheetPage'
import { FieldProfilePage } from './pages/field/FieldProfilePage'
import { ReportsHomePage } from './pages/reports/ReportsHomePage'
import { DueCollectionsReportPage } from './pages/reports/DueCollectionsReportPage'
import { DelinquencyAgingReportPage } from './pages/reports/DelinquencyAgingReportPage'
import { AgentCollectionsReportPage } from './pages/reports/AgentCollectionsReportPage'
import { PaymentRegisterReportPage } from './pages/reports/PaymentRegisterReportPage'
import { PortfolioSummaryReportPage } from './pages/reports/PortfolioSummaryReportPage'
import { LoanReleasesReportPage } from './pages/reports/LoanReleasesReportPage'
import { ExpectedVsActualReportPage } from './pages/reports/ExpectedVsActualReportPage'
import { ParReportPage } from './pages/reports/ParReportPage'
import { ClosedLoansReportPage } from './pages/reports/ClosedLoansReportPage'
import { GroupCollectionSheetPage } from './pages/reports/GroupCollectionSheetPage'
import { StatementsExportReportPage } from './pages/reports/StatementsExportReportPage'
import { InterestIncomeReportPage } from './pages/reports/InterestIncomeReportPage'
import { ApprovalTatReportPage } from './pages/reports/ApprovalTatReportPage'
import { RejectedApplicationsReportPage } from './pages/reports/RejectedApplicationsReportPage'
import { CustomerAssignmentsReportPage } from './pages/reports/CustomerAssignmentsReportPage'
import { FieldNotesLogReportPage } from './pages/reports/FieldNotesLogReportPage'
import { PaymentMethodsReportPage } from './pages/reports/PaymentMethodsReportPage'

function OfficeOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (isFieldAgent(user)) return <Navigate to="/field" replace />
  return <>{children}</>
}

function FieldOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!isFieldAgent(user)) return <Navigate to={homePathFor(user)} replace />
  return <>{children}</>
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePathFor(user)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomeRedirect />} />

        <Route
          element={
            <FieldOnly>
              <FieldAgentLayout />
            </FieldOnly>
          }
        >
          <Route element={<RequireAuth permission="field.collect" />}>
            <Route path="/field" element={<FieldDuePage />} />
          </Route>
          <Route element={<RequireAuth permission="customers.view" />}>
            <Route path="/field/customers" element={<FieldCustomersPage />} />
            <Route path="/field/customers/:id" element={<FieldCustomerSheetPage />} />
          </Route>
          <Route element={<RequireAuth permission="profile.view" />}>
            <Route path="/field/profile" element={<FieldProfilePage />} />
          </Route>
        </Route>

        <Route
          element={
            <OfficeOnly>
              <AppLayout />
            </OfficeOnly>
          }
        >
          <Route element={<RequireAuth permission="dashboard.view" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<RequireAuth permission="roles.view" />}>
            <Route path="/accessibility/roles" element={<RolesPage />} />
          </Route>
          <Route element={<RequireAuth permission="pages.view" />}>
            <Route path="/accessibility/pages" element={<PageAccessibilityPage />} />
          </Route>
          <Route element={<RequireAuth permission="users.view" />}>
            <Route path="/accessibility/users" element={<UsersPage />} />
          </Route>
          <Route element={<RequireAuth permission="customers.view" />}>
            <Route path="/transaction/customers" element={<CustomersPage />} />
          </Route>
          <Route element={<RequireAuth permission="loans.manage" />}>
            <Route path="/transaction/record-payment" element={<RecordPaymentPage />} />
          </Route>
          <Route element={<RequireAuth permission="activity.view" />}>
            <Route path="/transaction/activity" element={<ActivityPage />} />
          </Route>
          <Route element={<RequireAuth permission="paymentSchedule.view" />}>
            <Route path="/transaction/payment-schedule" element={<PaymentSchedulePage />} />
          </Route>
          <Route element={<RequireAuth permission="remittance.view" />}>
            <Route path="/transaction/remittances" element={<RemittancesPage />} />
          </Route>
          <Route element={<RequireAuth permission="flows.view" />}>
            <Route path="/lending/flows" element={<ProcessFlowsPage />} />
          </Route>
          <Route element={<RequireAuth permission="loanProducts.view" />}>
            <Route path="/lending/products" element={<LoanProductsPage />} />
          </Route>
          <Route element={<RequireAuth permission="loans.view" />}>
            <Route path="/lending/loans" element={<LoansPage />} />
          </Route>
          <Route element={<RequireAuth permission="dashboard.view" />}>
            <Route path="/lending/how-to-apply" element={<LoanTutorialPage />} />
          </Route>
          <Route element={<RequireAuth permission="approvals.view" />}>
            <Route path="/lending/approvals" element={<ApprovalsPage />} />
          </Route>
          <Route element={<RequireAuth permission="loans.view" />}>
            <Route path="/lending/rejected" element={<RejectedLoansPage />} />
          </Route>
          <Route element={<RequireAuth permission="reports.view" />}>
            <Route path="/reports" element={<ReportsHomePage />} />
            <Route path="/reports/due-collections" element={<DueCollectionsReportPage />} />
            <Route path="/reports/delinquency-aging" element={<DelinquencyAgingReportPage />} />
            <Route path="/reports/agent-collections" element={<AgentCollectionsReportPage />} />
            <Route path="/reports/payment-register" element={<PaymentRegisterReportPage />} />
            <Route path="/reports/portfolio-summary" element={<PortfolioSummaryReportPage />} />
            <Route path="/reports/loan-releases" element={<LoanReleasesReportPage />} />
            <Route path="/reports/expected-vs-actual" element={<ExpectedVsActualReportPage />} />
            <Route path="/reports/par" element={<ParReportPage />} />
            <Route path="/reports/closed-loans" element={<ClosedLoansReportPage />} />
            <Route path="/reports/group-collection-sheet" element={<GroupCollectionSheetPage />} />
            <Route path="/reports/statements" element={<StatementsExportReportPage />} />
            <Route path="/reports/interest-income" element={<InterestIncomeReportPage />} />
            <Route path="/reports/approval-tat" element={<ApprovalTatReportPage />} />
            <Route path="/reports/rejected-applications" element={<RejectedApplicationsReportPage />} />
            <Route path="/reports/customer-assignments" element={<CustomerAssignmentsReportPage />} />
            <Route path="/reports/field-notes-log" element={<FieldNotesLogReportPage />} />
            <Route path="/reports/payment-methods" element={<PaymentMethodsReportPage />} />
          </Route>
          <Route element={<RequireAuth permission="groups.view" />}>
            <Route path="/settings/groups" element={<GroupsPage />} />
          </Route>
          <Route element={<RequireAuth permission="branches.view" />}>
            <Route path="/settings/branches" element={<BranchesPage />} />
          </Route>
          <Route element={<RequireAuth permission="paymentSchedule.settings" />}>
            <Route path="/settings/payment-schedule" element={<PaymentScheduleSettingsPage />} />
          </Route>
          <Route element={<RequireAuth permission="lateFees.settings" />}>
            <Route path="/settings/late-fees" element={<LateFeesSettingsPage />} />
          </Route>
          <Route element={<RequireAuth permission="audit.view" />}>
            <Route path="/settings/audit-log" element={<AuditLogPage />} />
          </Route>
          <Route element={<RequireAuth permission="profile.view" />}>
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  )
}
