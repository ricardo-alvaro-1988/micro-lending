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
    default:
      return 'border-slate-200 bg-white text-slate-800'
  }
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

              <div className="mt-4 overflow-x-auto pb-1">
                <ol className="flex min-w-max items-stretch gap-0">
                  {trail.steps.map((step, index) => (
                    <li key={`${trail.loanId}-${step.id}-${index}`} className="flex items-center">
                      <div
                        className={`max-w-[220px] rounded-lg border px-3 py-2 shadow-sm ${stepTone(step.type)}`}
                      >
                        <div className="text-xs font-semibold leading-snug">{stepLabel(step)}</div>
                        <div className="mt-1 text-[11px] opacity-80">
                          {step.actorName ? (
                            <>
                              by <span className="font-medium">{step.actorName}</span>
                            </>
                          ) : (
                            <span className="italic">system / pending</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] opacity-70">
                          {new Date(step.occurredAt).toLocaleString()}
                        </div>
                      </div>
                      {index < trail.steps.length - 1 && (
                        <div className="mx-2 flex items-center text-slate-300" aria-hidden>
                          <span className="text-lg font-light">→</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Readable sentence trail */}
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {trail.steps
                  .map((step) => {
                    const who = step.actorName ? ` by ${step.actorName}` : ''
                    return `${stepLabel(step)}${who}`
                  })
                  .join('  →  ')}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
