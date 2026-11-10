import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { LoanApplicationReviewDialog } from '../components/LoanApplicationReviewDialog'
import { StageTag, StatusTag } from '../components/StatusTag'
import { useToast } from '../toast/ToastContext'

type RejectedLoan = {
  id: number
  loanNumber: string
  customerId: number
  customerName: string
  flowName: string
  currentStageName: string
  amount: number
  status: string
  rejectedAt: string
  rejectedBy?: string | null
  comments?: string | null
  createdAt: string
}

type PagedRejectedLoans = {
  items: RejectedLoan[]
  page: number
  pageSize: number
  totalCount: number
}

const PAGE_SIZE = 20

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function RejectedLoansPage() {
  const { filterBranchId } = useBranchScope()
  const [rows, setRows] = useState<RejectedLoan[]>([])
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const [reviewLoanId, setReviewLoanId] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, totalCount)

  const load = async (pageNum = page, term = q, fromDate = from, toDate = to) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pageNum))
      params.set('pageSize', String(PAGE_SIZE))
      if (term.trim()) params.set('q', term.trim())
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const data = await api<PagedRejectedLoans>(
        withBranchQuery(`/api/loans/rejected?${params.toString()}`, filterBranchId),
      )
      setRows(data.items)
      setTotalCount(data.totalCount)
      setPage(data.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load rejected applications')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  const search = () => {
    void load(1)
  }

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages)
    void load(clamped)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Rejected</h2>
        <p className="text-sm text-slate-500">
          Rejected loan applications. Search by date range, application number, or customer name — open Review for
          the full package.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1 text-sm text-slate-600 sm:max-w-sm">
          Application # / name
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Loan number or customer name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search()
            }}
          />
        </label>
        <label className="text-sm text-slate-600">
          From
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-600">
          To
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <ActionButton type="button" onClick={search}>
          Search
        </ActionButton>
        {(q || from || to) && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => {
              setQ('')
              setFrom('')
              setTo('')
              void load(1, '', '', '')
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          {loading && rows.length === 0
            ? 'Loading…'
            : `Showing ${rangeFrom}–${rangeTo} of ${totalCount.toLocaleString()}`}
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
              <th className="px-4 py-3 font-medium">Application #</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Rejected</th>
              <th className="px-4 py-3 font-medium">By</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <LoadingTableRow colSpan={8} label="Loading rejected applications…" />
            ) : (
              <>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={() => setReviewLoanId(row.id)}
                      >
                        {row.loanNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3">{row.customerName}</td>
                    <td className="px-4 py-3">
                      <StageTag stage={row.currentStageName} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{money(row.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{new Date(row.rejectedAt).toLocaleString()}</div>
                      <StatusTag status={row.status} />
                    </td>
                    <td className="px-4 py-3">{row.rejectedBy || '—'}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-slate-600" title={row.comments || undefined}>
                      {row.comments || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => setReviewLoanId(row.id)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      No rejected applications match your search.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {reviewLoanId != null && (
        <LoanApplicationReviewDialog loanId={reviewLoanId} onClose={() => setReviewLoanId(null)} />
      )}
    </div>
  )
}
