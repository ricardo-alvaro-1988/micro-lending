import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { ApprovalCommentViewer } from './ApprovalCommentViewer'
import { LoadingBlock } from './ListLoading'
import { StageTag, StatusTag } from './StatusTag'
import type { LoanDetailBundle } from '../types'
import { useToast } from '../toast/ToastContext'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Tab = 'overview' | 'schedule' | 'payments' | 'approvals'

type Props = {
  loanId: number
  /** When set, renders as a modal overlay. Omit for inline same-page panel. */
  onClose?: () => void
  className?: string
  headerActions?: ReactNode
}

export function LoanDetailsPanel({ loanId, onClose, className = '', headerActions }: Props) {
  const [detail, setDetail] = useState<LoanDetailBundle | null>(null)
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetail(null)
    setTab('overview')
    api<LoanDetailBundle>(`/api/loans/${loanId}/details`)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loanId])

  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loan = detail?.loan
  const body = (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
      onClick={onClose ? (e) => e.stopPropagation() : undefined}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">
            {loan?.loanNumber ?? `Loan #${loanId}`}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {loan ? `${loan.customerName} · ${loan.flowName}` : 'Loading full loan details…'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {headerActions}
          {onClose && (
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {loading || !loan || !detail ? (
        <LoadingBlock label="Loading loan details…" />
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 pt-3">
            {(
              [
                ['overview', 'Overview'],
                ['schedule', `Schedule (${detail.schedule.length})`],
                ['payments', `Payments (${detail.payments.length})`],
                ['approvals', `Approvals (${detail.approvals.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                  tab === key
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={`${onClose ? 'max-h-[70vh]' : 'max-h-[min(70vh,720px)]'} overflow-auto px-5 py-4`}>
            {tab === 'overview' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Status">
                  <StatusTag status={loan.status} />
                </DetailField>
                <DetailField label="Current stage">
                  <StageTag stage={loan.currentStageName} />
                </DetailField>
                <DetailField label="Customer" value={loan.customerName} />
                <DetailField label="Created by" value={loan.createdBy} />
                <DetailField label="Principal" value={money(loan.amount)} />
                <DetailField label="Interest rate" value={`${loan.interestRatePercent}%`} />
                <DetailField label="Interest amount" value={money(loan.interestAmount)} />
                <DetailField label="Total payable" value={money(loan.totalPayable)} />
                <DetailField label="Total paid" value={money(loan.totalPaid)} />
                <DetailField label="Remaining" value={money(loan.remainingBalance)} />
                <DetailField label="Term count" value={String(loan.termCount || '—')} />
                <DetailField label="Frequency" value={loan.paymentFrequency || '—'} />
                <DetailField
                  label="First due"
                  value={loan.firstDueDate ? loan.firstDueDate.slice(0, 10) : '—'}
                />
                <DetailField label="Installment" value={money(loan.installmentAmount)} />
                <DetailField label="Product" value={loan.loanProductName || '—'} />
                <DetailField label="Interest method" value={loan.interestMethod || '—'} />
                <DetailField label="Created" value={new Date(loan.createdAt).toLocaleString()} />
                <DetailField label="Has terms" value={loan.hasTerms ? 'Yes' : 'No'} />
                {loan.notes && (
                  <div className="sm:col-span-2">
                    <DetailField label="Notes" value={loan.notes} />
                  </div>
                )}
              </div>
            )}

            {tab === 'schedule' &&
              (detail.schedule.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No payment schedule yet.</p>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Due</th>
                        <th className="px-3 py-2 font-medium text-right">Due amt</th>
                        <th className="px-3 py-2 font-medium text-right">Paid</th>
                        <th className="px-3 py-2 font-medium text-right">Balance</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.schedule.map((s) => (
                        <tr key={s.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{s.installmentNumber}</td>
                          <td className="px-3 py-2">{s.dueDate.slice(0, 10)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(s.amountDue)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(s.paidAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(s.balance)}</td>
                          <td className="px-3 py-2">
                            <StatusTag status={s.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === 'payments' &&
              (detail.payments.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No payments recorded.</p>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">Paid at</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                        <th className="px-3 py-2 font-medium">Method</th>
                        <th className="px-3 py-2 font-medium">Reference</th>
                        <th className="px-3 py-2 font-medium">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(p.paidAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {money(p.amount)}
                          </td>
                          <td className="px-3 py-2">{p.method || '—'}</td>
                          <td className="px-3 py-2">{p.reference || '—'}</td>
                          <td className="px-3 py-2">{p.recordedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === 'approvals' &&
              (detail.approvals.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No approval history yet.</p>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">Stage</th>
                        <th className="px-3 py-2 font-medium">Decision</th>
                        <th className="px-3 py-2 font-medium">By</th>
                        <th className="px-3 py-2 font-medium">Requested</th>
                        <th className="px-3 py-2 font-medium">Decided</th>
                        <th className="px-3 py-2 font-medium">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.approvals.map((a) => (
                        <tr key={a.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{a.stageName}</td>
                          <td className="px-3 py-2">
                            <StatusTag status={a.decision} />
                          </td>
                          <td className="px-3 py-2">{a.decidedBy || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(a.requestedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {a.decidedAt ? new Date(a.decidedAt).toLocaleString() : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <ApprovalCommentViewer entry={a} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )

  if (!onClose) return body

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Loan details"
      onClick={onClose}
    >
      <div className="my-4 w-full max-w-4xl">{body}</div>
    </div>
  )
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{children ?? value}</div>
    </div>
  )
}
