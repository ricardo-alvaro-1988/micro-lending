import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { BranchFilter } from '../components/BranchFilter'
import {
  IconActivity,
  IconApprove,
  IconBell,
  IconBranch,
  IconCustomer,
  IconDashboard,
  IconFlow,
  IconGroup,
  IconLoan,
  IconLogout,
  IconMenu,
  IconNotify,
  IconPages,
  IconPanelLeft,
  IconProfile,
  IconRoles,
  IconSchedule,
  IconSettings,
  IconShield,
  IconTransaction,
  IconUsers,
} from '../components/Icons'
import type { ApprovalItem } from '../types'

type PendingScheduleItem = {
  loanId: number
  loanNumber: string
  customerName: string
  waitingHours: number
}

type NavChild = {
  label: string
  to: string
  permission: string
  icon: ReactNode
}

type NavItem = {
  label: string
  to?: string
  permission?: string
  icon?: ReactNode
  pending?: boolean
  children?: NavChild[]
}

const SIDEBAR_KEY = 'ml_sidebar_collapsed'

const nav: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    permission: 'dashboard.view',
    icon: <IconDashboard />,
  },
  {
    label: 'Transaction',
    icon: <IconTransaction />,
    children: [
      { label: 'Customers', to: '/transaction/customers', permission: 'customers.view', icon: <IconCustomer /> },
      { label: 'Activity', to: '/transaction/activity', permission: 'activity.view', icon: <IconActivity /> },
      {
        label: 'Payment Schedule',
        to: '/transaction/payment-schedule',
        permission: 'paymentSchedule.view',
        icon: <IconSchedule />,
      },
      {
        label: 'Cash Remittances',
        to: '/transaction/remittances',
        permission: 'remittance.view',
        icon: <IconTransaction />,
      },
    ],
  },
  {
    label: 'Lending',
    icon: <IconLoan />,
    children: [
      { label: 'Process Flows', to: '/lending/flows', permission: 'flows.view', icon: <IconFlow /> },
      { label: 'Loan Products', to: '/lending/products', permission: 'loanProducts.view', icon: <IconLoan /> },
      { label: 'Loans', to: '/lending/loans', permission: 'loans.view', icon: <IconLoan /> },
      { label: 'Approvals', to: '/lending/approvals', permission: 'approvals.view', icon: <IconApprove /> },
    ],
  },
  {
    label: 'Reports',
    icon: <IconSchedule />,
    children: [
      { label: 'All reports', to: '/reports', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Due collections', to: '/reports/due-collections', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Delinquency aging', to: '/reports/delinquency-aging', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Agent collections', to: '/reports/agent-collections', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Payment register', to: '/reports/payment-register', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Portfolio summary', to: '/reports/portfolio-summary', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Loan releases', to: '/reports/loan-releases', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Expected vs actual', to: '/reports/expected-vs-actual', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'PAR', to: '/reports/par', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Closed loans', to: '/reports/closed-loans', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Group sheet', to: '/reports/group-collection-sheet', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Statements export', to: '/reports/statements', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Interest income', to: '/reports/interest-income', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Approval TAT', to: '/reports/approval-tat', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Rejected apps', to: '/reports/rejected-applications', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Assignments', to: '/reports/customer-assignments', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Field notes log', to: '/reports/field-notes-log', permission: 'reports.view', icon: <IconSchedule /> },
      { label: 'Payment methods', to: '/reports/payment-methods', permission: 'reports.view', icon: <IconSchedule /> },
    ],
  },
  {
    label: 'Accessibility',
    icon: <IconShield />,
    children: [
      { label: 'Roles', to: '/accessibility/roles', permission: 'roles.view', icon: <IconRoles /> },
      { label: 'Page Accessibility', to: '/accessibility/pages', permission: 'pages.view', icon: <IconPages /> },
      { label: 'Users', to: '/accessibility/users', permission: 'users.view', icon: <IconUsers /> },
    ],
  },
  {
    label: 'Settings',
    icon: <IconSettings />,
    children: [
      { label: 'Groups', to: '/settings/groups', permission: 'groups.view', icon: <IconGroup /> },
      { label: 'Branches', to: '/settings/branches', permission: 'branches.view', icon: <IconBranch /> },
      {
        label: 'Payment Schedule Notify',
        to: '/settings/payment-schedule',
        permission: 'paymentSchedule.settings',
        icon: <IconNotify />,
      },
      {
        label: 'Late Fees',
        to: '/settings/late-fees',
        permission: 'lateFees.settings',
        icon: <IconNotify />,
      },
      {
        label: 'Audit Log',
        to: '/settings/audit-log',
        permission: 'audit.view',
        icon: <IconActivity />,
      },
    ],
  },
  {
    label: 'Profile',
    to: '/profile',
    permission: 'profile.view',
    icon: <IconProfile />,
  },
]

function linkClass(isActive: boolean, collapsed: boolean) {
  return `flex items-center gap-2.5 rounded-md text-sm transition-colors ${
    collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
  } ${isActive ? 'bg-[var(--accent)] text-white' : 'text-slate-200 hover:bg-[var(--sidebar-hover)]'}`
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function AppLayout() {
  const { user, logout, can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const navigate = useNavigate()
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Transaction: true,
    Lending: true,
    Accessibility: true,
    Settings: true,
  })
  const [loggingOut, setLoggingOut] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [approvalCount, setApprovalCount] = useState(0)
  const [latestApprovals, setLatestApprovals] = useState<ApprovalItem[]>([])
  const [scheduleCount, setScheduleCount] = useState(0)
  const [latestSchedules, setLatestSchedules] = useState<PendingScheduleItem[]>([])
  const [pendingLoanCount, setPendingLoanCount] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  /** If a refresh is requested while one is in flight, run once more afterward. */
  const runQueued = useCallback(async (inFlight: { current: boolean }, queued: { current: boolean }, work: () => Promise<void>) => {
    if (inFlight.current) {
      queued.current = true
      return
    }
    inFlight.current = true
    try {
      do {
        queued.current = false
        await work()
      } while (queued.current)
    } finally {
      inFlight.current = false
    }
  }, [])

  const refreshInFlight = useRef(false)
  const refreshQueued = useRef(false)
  const refreshApprovals = useCallback(async () => {
    if (!can('approvals.view')) {
      setApprovalCount(0)
      setLatestApprovals([])
      return
    }
    await runQueued(refreshInFlight, refreshQueued, async () => {
      try {
        const summary = await api<{ count: number; latest: ApprovalItem[] }>('/api/approvals/mine/summary')
        setApprovalCount(summary.count)
        setLatestApprovals(summary.latest ?? [])
      } catch {
        // ignore transient errors while polling
      }
    })
  }, [can, runQueued])

  const scheduleRefreshInFlight = useRef(false)
  const scheduleRefreshQueued = useRef(false)
  const refreshSchedules = useCallback(async () => {
    if (!can('paymentSchedule.view')) {
      setScheduleCount(0)
      setLatestSchedules([])
      return
    }
    await runQueued(scheduleRefreshInFlight, scheduleRefreshQueued, async () => {
      try {
        const summary = await api<{
          count: number
          latest: PendingScheduleItem[]
        }>('/api/payment-schedules/mine/summary')
        setScheduleCount(summary.count)
        setLatestSchedules(summary.latest ?? [])
      } catch {
        // ignore transient errors while polling
      }
    })
  }, [can, runQueued])

  const loanRefreshInFlight = useRef(false)
  const loanRefreshQueued = useRef(false)
  const refreshPendingLoans = useCallback(async () => {
    if (!can('loans.view')) {
      setPendingLoanCount(0)
      return
    }
    await runQueued(loanRefreshInFlight, loanRefreshQueued, async () => {
      try {
        const summary = await api<{ count: number }>(
          withBranchQuery('/api/loans/pending/summary', filterBranchId),
        )
        setPendingLoanCount(summary.count)
      } catch {
        // ignore transient errors while polling
      }
    })
  }, [can, filterBranchId, runQueued])

  useEffect(() => {
    void refreshApprovals()
    const id = window.setInterval(() => void refreshApprovals(), 15000)
    const onChanged = () => void refreshApprovals()
    const onFocus = () => void refreshApprovals()
    window.addEventListener('ml:approvals-changed', onChanged)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('ml:approvals-changed', onChanged)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refreshApprovals])

  useEffect(() => {
    void refreshSchedules()
    const id = window.setInterval(() => void refreshSchedules(), 15000)
    const onChanged = () => void refreshSchedules()
    const onFocus = () => void refreshSchedules()
    window.addEventListener('ml:payment-schedules-changed', onChanged)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('ml:payment-schedules-changed', onChanged)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refreshSchedules])

  useEffect(() => {
    void refreshPendingLoans()
    const id = window.setInterval(() => void refreshPendingLoans(), 15000)
    const onChanged = () => void refreshPendingLoans()
    const onFocus = () => void refreshPendingLoans()
    window.addEventListener('ml:loans-changed', onChanged)
    window.addEventListener('ml:approvals-changed', onChanged)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('ml:loans-changed', onChanged)
      window.removeEventListener('ml:approvals-changed', onChanged)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refreshPendingLoans])

  // Refresh badges whenever the user navigates (covers create/advance without a full reload).
  useEffect(() => {
    void refreshApprovals()
    void refreshSchedules()
    void refreshPendingLoans()
  }, [location.pathname, refreshApprovals, refreshSchedules, refreshPendingLoans])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const onLogout = () => {
    setLoggingOut(true)
    window.setTimeout(() => {
      logout()
      navigate('/login')
    }, 400)
  }

  const toggleSidebar = () => setCollapsed((v) => !v)

  const renderChildLabel = (child: NavChild) => (
    <>
      <span className="opacity-90">{child.icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1">{child.label}</span>
          {child.to === '/lending/loans' && <Badge count={pendingLoanCount} />}
          {child.to === '/lending/approvals' && <Badge count={approvalCount} />}
          {child.to === '/transaction/payment-schedule' && <Badge count={scheduleCount} />}
        </>
      )}
      {collapsed && child.to === '/lending/loans' && pendingLoanCount > 0 && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
      )}
      {collapsed && child.to === '/lending/approvals' && approvalCount > 0 && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
      )}
      {collapsed && child.to === '/transaction/payment-schedule' && scheduleCount > 0 && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
      )}
    </>
  )

  return (
    <div className="flex min-h-screen">
      <aside
        className={`flex flex-col bg-[var(--sidebar)] text-white transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className={`border-b border-white/10 ${collapsed ? 'px-2 py-4' : 'px-5 py-5'}`}>
          {collapsed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expand menu"
                aria-label="Expand menu"
                className="rounded-md p-2 text-sky-100 hover:bg-[var(--sidebar-hover)]"
              >
                <IconMenu />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-sky-200/80">Micro Lending</div>
                <div className="mt-1 text-lg font-semibold">Office Console</div>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Collapse menu"
                aria-label="Collapse menu"
                className="rounded-md p-1.5 text-sky-100 hover:bg-[var(--sidebar-hover)]"
              >
                <IconPanelLeft />
              </button>
            </div>
          )}
        </div>

        <nav className={`flex-1 space-y-1 ${collapsed ? 'p-2' : 'p-3'}`}>
          {nav.map((item) => {
            if (item.children) {
              const visible = item.children.filter((c) => can(c.permission))
              if (visible.length === 0) return null

              if (collapsed) {
                return (
                  <div key={item.label} className="space-y-1">
                    {visible.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        title={child.label}
                        className={({ isActive }) => `relative ${linkClass(isActive, true)}`}
                      >
                        {renderChildLabel(child)}
                      </NavLink>
                    ))}
                  </div>
                )
              }

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [item.label]: !(prev[item.label] ?? true) }))
                    }
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-sky-100 hover:bg-[var(--sidebar-hover)]"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="opacity-90">{item.icon}</span>
                      {item.label}
                      {item.label === 'Lending' && approvalCount + pendingLoanCount > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {approvalCount + pendingLoanCount}
                        </span>
                      )}
                    </span>
                    <span className="text-xs opacity-70">{(openGroups[item.label] ?? true) ? '▾' : '▸'}</span>
                  </button>
                  {(openGroups[item.label] ?? true) && (
                    <div className="ml-2 space-y-1 border-l border-white/10 pl-2">
                      {visible.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) => linkClass(isActive, false)}
                        >
                          {renderChildLabel(child)}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            if (item.pending) {
              return (
                <div
                  key={item.label}
                  title="Coming soon"
                  className={`flex cursor-not-allowed items-center gap-2.5 rounded-md text-sm text-slate-400/70 ${
                    collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
                  }`}
                >
                  <span className="opacity-70">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span>{item.label}</span>
                      <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-200/70">
                        Soon
                      </span>
                    </>
                  )}
                </div>
              )
            }

            if (item.permission && !can(item.permission)) return null
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                title={item.label}
                className={({ isActive }) => linkClass(isActive, collapsed)}
              >
                <span className="opacity-90">{item.icon}</span>
                {!collapsed && item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className={`border-t border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
          {!collapsed && (
            <>
              <div className="text-sm font-medium">{user?.fullName}</div>
              <div className="text-xs text-sky-200/80">
                {user?.role}
                {user?.branchName ? ` · ${user.branchName}` : user?.isAdmin ? ' · All branches' : ''}
              </div>
            </>
          )}
          <ActionButton
            type="button"
            variant="ghost"
            loading={loggingOut}
            loadingText={collapsed ? '' : 'Logging out…'}
            onClick={onLogout}
            title="Logout"
            className={`w-full ${collapsed ? 'mt-0 px-2' : 'mt-3'}`}
          >
            <span className={`inline-flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
              {!loggingOut && <IconLogout />}
              {!collapsed && 'Logout'}
            </span>
          </ActionButton>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <IconMenu className="h-4 w-4" />
            </button>
            <h1 className="text-base font-semibold text-slate-800">Welcome back</h1>
            <BranchFilter className="hidden sm:flex" />
          </div>

          <div className="flex items-center gap-3">
            <BranchFilter className="sm:hidden" />
            {(can('approvals.view') || can('paymentSchedule.view')) && (
              <div className="relative" ref={bellRef}>
                <button
                  type="button"
                  onClick={() => {
                    setBellOpen((v) => !v)
                    void refreshApprovals()
                    void refreshSchedules()
                  }}
                  className="relative rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <IconBell className="h-4 w-4" />
                  {approvalCount + scheduleCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                      {approvalCount + scheduleCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {can('paymentSchedule.view') && (
                      <>
                        <div className="border-b border-slate-100 px-4 py-3">
                          <div className="text-sm font-semibold text-slate-800">Payment schedules</div>
                          <div className="text-xs text-slate-500">
                            {scheduleCount === 0
                              ? 'No urgent schedules'
                              : `${scheduleCount} Approved-Final loan${scheduleCount === 1 ? '' : 's'} need a schedule`}
                          </div>
                        </div>
                        <div className="max-h-40 overflow-auto">
                          {latestSchedules.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-slate-500">No payment schedules waiting.</div>
                          ) : (
                            latestSchedules.map((item) => (
                              <button
                                key={item.loanId}
                                type="button"
                                className="block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
                                onClick={() => {
                                  setBellOpen(false)
                                  navigate('/transaction/payment-schedule')
                                }}
                              >
                                <div className="text-sm font-medium text-slate-800">{item.loanNumber}</div>
                                <div className="text-xs text-slate-500">{item.customerName}</div>
                                <div className="mt-1 text-xs text-rose-700">
                                  Urgent · waiting {item.waitingHours < 1 ? '<1h' : `${item.waitingHours}h`}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                        <button
                          type="button"
                          className="w-full border-b border-slate-100 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setBellOpen(false)
                            navigate('/transaction/payment-schedule')
                          }}
                        >
                          Open Payment Schedule
                        </button>
                      </>
                    )}

                    {can('approvals.view') && (
                      <>
                        <div className="border-b border-slate-100 px-4 py-3">
                          <div className="text-sm font-semibold text-slate-800">Approvals for you</div>
                          <div className="text-xs text-slate-500">
                            {approvalCount === 0 ? 'No pending items' : `${approvalCount} waiting for your decision`}
                          </div>
                        </div>
                        <div className="max-h-40 overflow-auto">
                          {latestApprovals.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-slate-500">You are all caught up.</div>
                          ) : (
                            latestApprovals.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
                                onClick={() => {
                                  setBellOpen(false)
                                  navigate('/lending/approvals')
                                }}
                              >
                                <div className="text-sm font-medium text-slate-800">{item.loanNumber}</div>
                                <div className="text-xs text-slate-500">
                                  {item.customerName} · {item.stageName}
                                </div>
                                <div className="mt-1 text-xs text-amber-700">Needs your approve / decline</div>
                              </button>
                            ))
                          )}
                        </div>
                        <button
                          type="button"
                          className="w-full border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-50"
                          onClick={() => {
                            setBellOpen(false)
                            navigate('/lending/approvals')
                          }}
                        >
                          Open Approvals
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {user?.role}
            </div>
          </div>
        </header>

        {scheduleCount > 0 && location.pathname !== '/transaction/payment-schedule' && (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-2 text-sm text-rose-900">
            <strong>{scheduleCount}</strong> Approved-Final loan{scheduleCount === 1 ? '' : 's'} urgently need a
            payment schedule.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => navigate('/transaction/payment-schedule')}
            >
              Create now
            </button>
          </div>
        )}

        {pendingLoanCount > 0 && location.pathname !== '/lending/loans' && (
          <div className="border-b border-sky-200 bg-sky-50 px-6 py-2 text-sm text-sky-900">
            <strong>{pendingLoanCount}</strong> loan{pendingLoanCount === 1 ? '' : 's'} in progress or
            awaiting approval.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => navigate('/lending/loans')}
            >
              View loans
            </button>
          </div>
        )}

        {approvalCount > 0 && location.pathname !== '/lending/approvals' && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
            You have <strong>{approvalCount}</strong> loan approval{approvalCount === 1 ? '' : 's'} waiting.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => navigate('/lending/approvals')}
            >
              Review now
            </button>
          </div>
        )}

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
