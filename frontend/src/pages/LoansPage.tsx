import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingBlock, LoadingTableRow } from '../components/ListLoading'
import { StatusTag } from '../components/StatusTag'
import type { Loan, LoanDetailBundle, PagedLoans } from '../types'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  '',
  'InProgress',
  'PendingApproval',
  'ApprovedFinal',
  'Closed',
  'Rejected',
] as const

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function notifyLoansChanged() {
  window.dispatchEvent(new Event('ml:loans-changed'))
}

export function LoansPage() {
  const { can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const canManage = can('loans.manage')
  const [loans, setLoans] = useState<Loan[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [advancingId, setAdvancingId] = useState<number | null>(null)
  const [detailLoanId, setDetailLoanId] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, totalCount)

  const load = async (pageNum = page, term = q, statusFilter = status) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pageNum))
      params.set('pageSize', String(PAGE_SIZE))
      if (term.trim()) params.set('q', term.trim())
      if (statusFilter) params.set('status', statusFilter)
      const data = await api<PagedLoans>(
        withBranchQuery(`/api/loans?${params.toString()}`, filterBranchId),
      )
      setLoans(data.items)
      setTotalCount(data.totalCount)
      setPage(data.page)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  useEffect(() => {
    const onChanged = () => void load().catch(() => undefined)
    window.addEventListener('ml:loans-changed', onChanged)
    window.addEventListener('ml:approvals-changed', onChanged)
    return () => {
      window.removeEventListener('ml:loans-changed', onChanged)
      window.removeEventListener('ml:approvals-changed', onChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, page, q, status])

  const search = () => {
    void load(1)
  }

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages)
    void load(clamped)
  }

  const onAdvance = async (id: number) => {
    setAdvancingId(id)
    setError('')
    try {
      await api(`/api/loans/${id}/advance`, { method: 'POST' })
      notifyLoansChanged()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Advance failed')
    } finally {
      setAdvancingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Loans</h2>
          <p className="text-sm text-slate-500">
            Search and page through loans. Open full details for terms, schedule, payments, and approvals.
          </p>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[16rem] flex-1 text-sm text-slate-600 sm:max-w-md">
          Search
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Loan #, customer, flow, stage, product, notes, amount…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search()
            }}
          />
        </label>
        <label className="text-sm text-slate-600">
          Status
          <select
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <ActionButton type="button" onClick={search}>
          Search
        </ActionButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          {loading && loans.length === 0
            ? 'Loading…'
            : `Showing ${from}–${to} of ${totalCount.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => goTo(page - 1)}
          >
            Previous
          </button>
          <span className="tabular-nums text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={page >= totalPages || loading}
            onClick={() => goTo(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Loan #</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Flow</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && loans.length === 0 ? (
              <LoadingTableRow colSpan={7} label="Loading loans..." />
            ) : (
              <>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={() => setDetailLoanId(loan.id)}
                      >
                        {loan.loanNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3">{loan.customerName}</td>
                    <td className="px-4 py-3">{loan.flowName}</td>
                    <td className="px-4 py-3">{loan.currentStageName}</td>
                    <td className="px-4 py-3 tabular-nums">{money(loan.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusTag status={loan.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setDetailLoanId(loan.id)}
                        >
                          Details
                        </button>
                        {canManage && loan.canAdvance && (
                          <ActionButton
                            type="button"
                            loading={advancingId === loan.id}
                            loadingText="Moving…"
                            onClick={() => void onAdvance(loan.id)}
                            className="px-3 py-1.5 text-xs"
                          >
                            Move next
                          </ActionButton>
                        )}
                        {loan.status === 'PendingApproval' && (
                          <StatusTag status="Pending" label="Waiting approval" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && loans.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={7}>
                      No loans match your search.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Showing {from}–{to} of {totalCount.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              disabled={page <= 1 || loading}
              onClick={() => goTo(page - 1)}
            >
              Previous
            </button>
            <span className="tabular-nums text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              disabled={page >= totalPages || loading}
              onClick={() => goTo(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {detailLoanId != null && (
        <LoanDetailsDialog loanId={detailLoanId} onClose={() => setDetailLoanId(null)} />
      )}
    </div>
  )
}

function LoanDetailsDialog({ loanId, onClose }: { loanId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<LoanDetailBundle | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'schedule' | 'payments' | 'approvals'>('overview')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDetail(null)
    setTab('overview')
    api<LoanDetailBundle>(`/api/loans/${loanId}/details`)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loanId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loan = detail?.loan

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Loan details"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {loan?.loanNumber ?? `Loan #${loanId}`}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {loan ? `${loan.customerName} · ${loan.flowName}` : 'Loading full loan details…'}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading || !loan ? (
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

            <div className="max-h-[70vh] overflow-auto px-5 py-4">
              {tab === 'overview' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField label="Status">
                    <StatusTag status={loan.status} />
                  </DetailField>
                  <DetailField label="Current stage" value={loan.currentStageName} />
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
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
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
                            <td className="px-3 py-2 max-w-xs truncate" title={a.comments || undefined}>
                              {a.comments || '—'}
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
