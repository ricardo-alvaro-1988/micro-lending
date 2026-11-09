import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingBlock } from '../components/ListLoading'
import { StatusTag } from '../components/StatusTag'
import type { LoanActivityStep, LoanActivityTrail } from '../types'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function stepLabel(step: LoanActivityStep) {
  switch (step.type) {
    case 'ApplicationSubmitted':
      return 'Application'
    case 'ApprovalRequested':
      return `${step.stageName} · awaiting`
    case 'Approved':
      return `${step.stageName} · approved`
    case 'Declined':
      return `${step.stageName} · declined`
    case 'StageEntered':
      return step.stageName
    case 'Advanced':
      return `Advanced from ${step.stageName}`
    case 'Closed':
      return 'Closed'
    case 'ApprovedFinal':
      return 'Approved-Final'
    case 'Rejected':
      return 'Rejected'
    default:
      return step.stageName || step.type
  }
}

function actionLabel(type: string) {
  switch (type) {
    case 'ApplicationSubmitted':
      return 'Submitted'
    case 'ApprovalRequested':
      return 'Awaiting'
    case 'Approved':
      return 'Approved'
    case 'Declined':
      return 'Declined'
    case 'StageEntered':
      return 'Entered'
    case 'Advanced':
      return 'Advanced'
    case 'Closed':
      return 'Closed'
    case 'ApprovedFinal':
      return 'Final'
    case 'Rejected':
      return 'Rejected'
    default:
      return type
  }
}

function stepTone(type: string): string {
  switch (type) {
    case 'Approved':
    case 'ApprovedFinal':
    case 'Closed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900'
    case 'Declined':
    case 'Rejected':
      return 'border-rose-200 bg-rose-50 text-rose-900'
    case 'ApprovalRequested':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'ApplicationSubmitted':
      return 'border-sky-200 bg-sky-50 text-sky-900'
    case 'Advanced':
    case 'StageEntered':
      return 'border-indigo-200 bg-indigo-50 text-indigo-900'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-800'
  }
}

function actionTone(type: string): string {
  switch (type) {
    case 'Approved':
    case 'ApprovedFinal':
    case 'Closed':
      return 'bg-emerald-600 text-white'
    case 'Declined':
    case 'Rejected':
      return 'bg-rose-600 text-white'
    case 'ApprovalRequested':
      return 'bg-amber-500 text-white'
    case 'ApplicationSubmitted':
      return 'bg-sky-600 text-white'
    case 'Advanced':
    case 'StageEntered':
      return 'bg-indigo-600 text-white'
    default:
      return 'bg-slate-500 text-white'
  }
}

function ActivityStepTag({ step }: { step: LoanActivityStep }) {
  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-sm ${stepTone(step.type)}`}
      title={new Date(step.occurredAt).toLocaleString()}
    >
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionTone(step.type)}`}>
        {actionLabel(step.type)}
      </span>
      <span className="font-semibold leading-snug">{stepLabel(step)}</span>
      {step.actorName ? (
        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
          {step.actorName}
        </span>
      ) : (
        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] italic text-slate-500">pending</span>
      )}
    </span>
  )
}

export function ActivityPage() {
  const { filterBranchId } = useBranchScope()
  const [trails, setTrails] = useState<LoanActivityTrail[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (term = q) => {
    setLoading(true)
    try {
      const path = term.trim() ? `/api/activity?q=${encodeURIComponent(term.trim())}` : '/api/activity'
      setTrails(await api<LoanActivityTrail[]>(withBranchQuery(path, filterBranchId)))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Activity</h2>
          <p className="text-sm text-slate-500">
            Process-flow trail for each loan — application through each approval and stage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search loan # or customer"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load()
            }}
          />
          <ActionButton type="button" onClick={() => void load()}>
            Search
          </ActionButton>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <LoadingBlock label="Loading activity..." />
        </div>
      ) : trails.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500 shadow-sm">
          No loan activity yet. Create a loan to start the process trail.
        </div>
      ) : (
        <div className="space-y-4">
          {trails.map((trail) => (
            <article key={trail.loanId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{trail.loanNumber}</h3>
                    <StatusTag status={trail.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{trail.customerName}</span>
                    {' · '}
                    {trail.flowName}
                    {' · '}
                    {money(trail.amount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created by {trail.createdBy} · {new Date(trail.createdAt).toLocaleString()} · Now at{' '}
                    {trail.currentStageName}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {trail.steps.map((step, index) => (
                  <div key={`${trail.loanId}-${step.id}-${index}`} className="flex items-center gap-2">
                    <ActivityStepTag step={step} />
                    {index < trail.steps.length - 1 && (
                      <span className="text-slate-300" aria-hidden>
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
