import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type StepKind = 'staff' | 'approval' | 'ready'

type Step = {
  n: number
  title: string
  kind: StepKind
  where: string
  do: string
  result: string
  href?: string
  permission?: string
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Create customer',
    kind: 'staff',
    where: 'Transaction → Customers',
    do: 'Save profile, agents, KYC',
    result: 'Customer ready for loan',
    href: '/transaction/customers',
    permission: 'customers.view',
  },
  {
    n: 2,
    title: 'Create loan app',
    kind: 'staff',
    where: 'Customer → Loan Application',
    do: 'Pick flow, product/amount, create',
    result: 'Starts at first stage',
    href: '/transaction/customers',
    permission: 'customers.view',
  },
  {
    n: 3,
    title: 'Application',
    kind: 'staff',
    where: 'Loan Application / Loans',
    do: 'Click Move next',
    result: 'Goes to Credit Review',
    href: '/lending/loans',
    permission: 'loans.view',
  },
  {
    n: 4,
    title: 'Credit Review',
    kind: 'approval',
    where: 'Lending → Approvals',
    do: 'Approve or Decline + notes',
    result: 'Approve → Manager; Decline → Application',
    href: '/lending/approvals',
    permission: 'approvals.view',
  },
  {
    n: 5,
    title: 'Manager Approval',
    kind: 'approval',
    where: 'Lending → Approvals',
    do: 'Approve or Decline + notes',
    result: 'Approve → Disbursement; Decline → Application',
    href: '/lending/approvals',
    permission: 'approvals.view',
  },
  {
    n: 6,
    title: 'Disbursement stage',
    kind: 'staff',
    where: 'Loan Application',
    do: 'Click Move next',
    result: 'Workflow step only — not the cash release',
    href: '/lending/loans',
    permission: 'loans.view',
  },
  {
    n: 7,
    title: 'Approved-Final',
    kind: 'ready',
    where: 'System status',
    do: 'Reached by Move next from Disbursement',
    result: 'Loan released; ready for payment terms',
    href: '/reports/loan-releases',
    permission: 'reports.view',
  },
  {
    n: 8,
    title: 'Payment terms + schedule',
    kind: 'ready',
    where: 'Payment Terms / Schedule',
    do: 'Set rate, term, first due',
    result: 'Installments generated; then collect',
    href: '/transaction/payment-schedule',
    permission: 'paymentSchedule.view',
  },
]

const kindLabel: Record<StepKind, string> = {
  staff: 'Staff action',
  approval: 'Approval gate',
  ready: 'Ready / terms',
}

const kindTone: Record<StepKind, string> = {
  staff: 'bg-sky-100 text-sky-800',
  approval: 'bg-amber-100 text-amber-900',
  ready: 'bg-emerald-100 text-emerald-800',
}

export function LoanTutorialPage() {
  const { can } = useAuth()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">How to apply a loan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Standard individual flow — where to act and what happens next.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Quick walkthrough</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Create the <strong>customer</strong> first.
          </li>
          <li>
            Open <strong>Loan Application</strong>, pick a process flow (and optional product), create the loan.
          </li>
          <li>
            <strong>Move next</strong> through non-approval stages.
          </li>
          <li>
            Assigned users <strong>Approve / Decline</strong> gated stages (Credit Review, Manager Approval). Decline
            returns the loan to Application.
          </li>
          <li>
            Move next through <strong>Disbursement</strong> (stage only — not cash out), then{' '}
            <strong>Approved-Final</strong> (loan released).
          </li>
          <li>
            After <strong>Approved-Final</strong>, set <strong>payment terms</strong> so the schedule is generated, then
            collect.
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-sky-800">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Staff action
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Approval gate
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready / terms
        </span>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step) => (
          <li key={step.n} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {step.n}. {step.title}
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${kindTone[step.kind]}`}>
                {kindLabel[step.kind]}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Where</dt>
                <dd className="mt-1 text-sm text-slate-800">{step.where}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Do</dt>
                <dd className="mt-1 text-sm text-slate-800">{step.do}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Result</dt>
                <dd className="mt-1 text-sm text-slate-800">{step.result}</dd>
              </div>
            </dl>
            {step.href && (!step.permission || can(step.permission)) && (
              <div className="mt-4">
                <Link
                  to={step.href}
                  className="inline-flex rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Open {step.title}
                </Link>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
