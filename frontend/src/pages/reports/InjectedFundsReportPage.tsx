import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { formatPhDateTime } from '../../lib/phDate'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  id: number
  injectionDate: string
  amount: number
  notes?: string | null
  branchId?: number | null
  branchName?: string | null
  recordedBy: string
  createdAt: string
}

type Result = {
  from: string
  to: string
  count: number
  totalAmount: number
  rows: Row[]
}

export function InjectedFundsReportPage() {
  const { filterBranchId } = useReportFilters()
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to })
      setData(await api<Result>(withBranchQuery(`/api/reports/injected-funds?${qs}`, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const rows = data?.rows ?? []

  return (
    <ReportChrome
      title="Injected funds"
      description="Office float top-ups recorded from Cashflow (Inject fund)."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `injected-funds-${from}_${to}.csv`,
          ['Date', 'Amount', 'Branch', 'Notes', 'Recorded by', 'Recorded at'],
          rows.map((r) => [
            r.injectionDate.slice(0, 10),
            r.amount,
            r.branchName,
            r.notes,
            r.recordedBy,
            r.createdAt,
          ]),
        )
      }
      filters={
        <div className="flex flex-wrap gap-3">
          <FilterField label="From">
            <input className={filterClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FilterField>
          <FilterField label="To">
            <input className={filterClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FilterField>
        </div>
      }
      summary={
        <ReportSummary>
          <ReportStat label="Injections" value={String(data?.count ?? 0)} />
          <ReportStat label="Total amount" value={money(data?.totalAmount ?? 0)} />
        </ReportSummary>
      }
    >
      <div className="overflow-x-auto p-4">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="border border-slate-200 px-3 py-2">Date</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Amount</th>
              <th className="border border-slate-200 px-3 py-2">Branch</th>
              <th className="border border-slate-200 px-3 py-2">Notes</th>
              <th className="border border-slate-200 px-3 py-2">Recorded by</th>
              <th className="border border-slate-200 px-3 py-2">Recorded at</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-slate-200 px-3 py-8 text-center text-slate-500">
                  No injected funds in this period.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="break-inside-avoid">
                  <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                    {r.injectionDate.slice(0, 10)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-medium">
                    {money(r.amount)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2">{r.branchName || '—'}</td>
                  <td className="border border-slate-200 px-3 py-2">{r.notes || '—'}</td>
                  <td className="border border-slate-200 px-3 py-2">{r.recordedBy}</td>
                  <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-slate-600">
                    {formatPhDateTime(r.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-emerald-50 font-semibold text-emerald-950">
                <td className="border border-slate-200 px-3 py-2">Total</td>
                <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                  {money(data?.totalAmount ?? 0)}
                </td>
                <td className="border border-slate-200 px-3 py-2" colSpan={4}>
                  {data?.count ?? 0} injection{(data?.count ?? 0) === 1 ? '' : 's'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportChrome>
  )
}
