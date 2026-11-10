import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { LoanDetailsPanel } from '../components/LoanDetailsPanel'
import { StatusTag } from '../components/StatusTag'
import {
  notifyApprovalsChanged,
  notifyLoansChanged,
  notifyPaymentSchedulesChanged,
} from '../notify'
import type { Loan, PagedLoans } from '../types'

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

/** @deprecated Prefer importing from `../notify`. */
export { notifyLoansChanged }

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
      // Advance can create/clear approvals and reach Approved-Final (schedule queue).
      notifyLoansChanged()
      notifyApprovalsChanged()
      notifyPaymentSchedulesChanged()
      await load()
      notifyLoansChanged()
      notifyApprovalsChanged()
      notifyPaymentSchedulesChanged()
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
        <LoanDetailsPanel loanId={detailLoanId} onClose={() => setDetailLoanId(null)} />
      )}
    </div>
  )
}

