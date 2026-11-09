import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type StepKind = 'staff' | 'approval' | 'ready'

type Step = {
  id: string
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
    id: '1',
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
    id: '2',
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
    id: '3',
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
    id: '4',
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
    id: '5',
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
    id: '6',
    n: 6,
    title: 'Disbursement',
    kind: 'staff',
    where: 'Loan Application',
    do: 'Click Move next',
    result: 'Stage name only; not a cash transfer',
    href: '/lending/loans',
    permission: 'loans.view',
  },
  {
    id: '7',
    n: 7,
    title: 'Approved-Final',
    kind: 'ready',
    where: 'System status',
    do: 'Automatic on final stage',
    result: 'Counts as released / disbursed',
    href: '/reports/loan-releases',
    permission: 'reports.view',
  },
  {
    id: '8',
    n: 8,
    title: 'Payment terms + schedule',
    kind: 'ready',
    where: 'Payment Terms / Schedule',
    do: 'Set rate, term, first due',
    result: 'Installments generated; collect',
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

const nodeFill: Record<StepKind, string> = {
  staff: '#f0f9ff',
  approval: '#fffbeb',
  ready: '#ecfdf5',
}

const nodeRing: Record<StepKind, string> = {
  staff: '#0ea5e9',
  approval: '#d97706',
  ready: '#059669',
}

export function LoanTutorialPage() {
  const { can } = useAuth()
  const [activeId, setActiveId] = useState('1')
  const active = STEPS.find((s) => s.id === activeId) ?? STEPS[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">How to apply a loan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Standard individual flow. Click any box for where to act and what happens next.
        </p>
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <svg
          viewBox="0 0 736 420"
          className="mx-auto h-auto w-full min-w-[640px] max-w-4xl"
          role="img"
          aria-label="Loan application process flowchart"
        >
          <defs>
            <marker id="tut-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#334155" />
            </marker>
          </defs>

          <FlowBox
            step={STEPS[0]}
            x={24}
            y={28}
            w={148}
            active={activeId === '1'}
            onSelect={setActiveId}
          />
          <line x1="172" y1="56" x2="212" y2="56" stroke="#334155" strokeWidth="1.5" markerEnd="url(#tut-arrow)" />
          <FlowBox
            step={STEPS[1]}
            x={212}
            y={28}
            w={160}
            active={activeId === '2'}
            onSelect={setActiveId}
          />
          <line x1="372" y1="56" x2="412" y2="56" stroke="#334155" strokeWidth="1.5" markerEnd="url(#tut-arrow)" />
          <FlowBox
            step={STEPS[2]}
            x={412}
            y={28}
            w={140}
            active={activeId === '3'}
            onSelect={setActiveId}
          />

          <path d="M552 56 H580 V120 H268" fill="none" stroke="#334155" strokeWidth="1.5" markerEnd="url(#tut-arrow)" />

          <FlowBox
            step={STEPS[3]}
            x={188}
            y={148}
            w={160}
            active={activeId === '4'}
            onSelect={setActiveId}
          />
          <line x1="348" y1="176" x2="388" y2="176" stroke="#334155" strokeWidth="1.5" markerEnd="url(#tut-arrow)" />
          <FlowBox
            step={STEPS[4]}
            x={388}
            y={148}
            w={168}
            active={activeId === '5'}
            onSelect={setActiveId}
          />

          <path
            d="M268 204 V236 H100 V84 H98"
            fill="none"
            stroke="#dc2626"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            markerEnd="url(#tut-arrow)"
          />
          <text x="120" y="228" fill="#dc2626" fontSize="11">
            Decline
          </text>
          <path
            d="M472 204 V236 H636 V84 H552"
            fill="none"
            stroke="#dc2626"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            markerEnd="url(#tut-arrow)"
          />
          <text x="580" y="228" fill="#dc2626" fontSize="11">
            Decline
          </text>

          <path d="M556 176 H596 V268 H268" fill="none" stroke="#334155" strokeWidth="1.5" markerEnd="url(#tut-arrow)" />

          <FlowBox
            step={STEPS[5]}
            x={188}
            y={268}
            w={160}
            active={activeId === '6'}
            onSelect={setActiveId}
          />
          <line x1="348" y1="296" x2="388" y2="296" stroke="#334155" strokeWidth="1.5" markerEnd="url(#tut-arrow)" />
          <FlowBox
            step={STEPS[6]}
            x={388}
            y={268}
            w={168}
            active={activeId === '7'}
            onSelect={setActiveId}
          />

          <line x1="472" y1="324" x2="472" y2="356" stroke="#334155" strokeWidth="1.5" markerEnd="url(#tut-arrow)" />
          <FlowBox
            step={STEPS[7]}
            x={360}
            y={356}
            w={224}
            active={activeId === '8'}
            onSelect={setActiveId}
          />
        </svg>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">
            {active.n} · {active.title}
          </h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${kindTone[active.kind]}`}>
            {kindLabel[active.kind]}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Where</dt>
            <dd className="mt-1 text-sm text-slate-800">{active.where}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Do</dt>
            <dd className="mt-1 text-sm text-slate-800">{active.do}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Result</dt>
            <dd className="mt-1 text-sm text-slate-800">{active.result}</dd>
          </div>
        </dl>
        {active.href && (!active.permission || can(active.permission)) && (
          <div className="mt-4">
            <Link
              to={active.href}
              className="inline-flex rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Open {active.title}
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Quick walkthrough</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Create the <strong>customer</strong> first.</li>
          <li>
            Open <strong>Loan Application</strong>, pick a process flow (and optional product), create the loan.
          </li>
          <li>
            <strong>Move next</strong> through non-approval stages.
          </li>
          <li>
            Assigned users <strong>Approve / Decline</strong> gated stages (Credit Review, Manager Approval).
          </li>
          <li>
            After <strong>Approved-Final</strong>, set <strong>payment terms</strong> so the schedule is generated, then
            collect.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">Click any box in the diagram for where to act and what happens next.</p>
      </div>
    </div>
  )
}

function FlowBox({
  step,
  x,
  y,
  w,
  active,
  onSelect,
}: {
  step: Step
  x: number
  y: number
  w: number
  active: boolean
  onSelect: (id: string) => void
}) {
  const fill = nodeFill[step.kind]
  const ring = nodeRing[step.kind]
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${step.n}. ${step.title}`}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(step.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(step.id)
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={56}
        rx={8}
        fill={fill}
        stroke={active ? ring : '#94a3b8'}
        strokeWidth={active ? 2.5 : 1.4}
      />
      <circle cx={x + 20} cy={y + 28} r={10} fill={ring} />
      <text x={x + 20} y={y + 32} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
        {step.n}
      </text>
      <text x={x + w / 2 + 8} y={y + 24} textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="600">
        {step.title.length > 22 ? `${step.title.slice(0, 20)}…` : step.title}
      </text>
      <text x={x + w / 2 + 8} y={y + 42} textAnchor="middle" fill="#64748b" fontSize="11">
        {step.kind === 'approval' ? 'Approve / Decline' : step.kind === 'ready' ? 'Ready' : 'Staff'}
      </text>
    </g>
  )
}
