import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  customerId: number
  customerName: string
  loanId: number
  loanNumber: string
  date: string
  type: string
  description: string
  debit: number
  credit: number
  balance: number
}

export function StatementsExportReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [agent1UserId, setAgent1UserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to })
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (groupId) qs.set('groupId', groupId)
      setRows(await api<Row[]>(withBranchQuery(`/api/reports/statements?${qs}`, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to, agent1UserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const customers = new Set<number>()
    const loans = new Set<number>()
    let debit = 0
    let credit = 0
    for (const r of rows) {
      customers.add(r.customerId)
      loans.add(r.loanId)
      debit += r.debit
      credit += r.credit
    }
    return { customers: customers.size, loans: loans.size, debit, credit }
  }, [rows])

  return (
    <ReportChrome
      title="Statements export"
      description="Bulk statement lines across customers for the date range (CSV-friendly)."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `statements-${from}_${to}.csv`,
          ['Customer', 'Loan', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance'],
          rows.map((r) => [
            r.customerName,
            r.loanNumber,
            r.date,
            r.type,
            r.description,
            r.debit,
            r.credit,
            r.balance,
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
          <FilterField label="Agent 1">
            <select className={filterClass} value={agent1UserId} onChange={(e) => setAgent1UserId(e.target.value)}>
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Group">
            <select className={filterClass} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </FilterField>
        </div>
      }
      summary={
        <ReportSummary>
          <ReportStat label="Customers" value={String(totals.customers)} hint={`${totals.loans} loan(s)`} />
          <ReportStat label="Lines" value={String(rows.length)} />
          <ReportStat label="Total debit" value={money(totals.debit)} />
          <ReportStat label="Total credit" value={money(totals.credit)} />
        </ReportSummary>
      }
    >
      <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
        {rows.length} line(s)
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Loan</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No statement lines in this range.
                </td>
              </tr>
            ) : (
              rows.slice(0, 500).map((r, idx) => (
                <tr key={`${r.loanId}-${r.date}-${idx}`}>
                  <td className="px-3 py-2">{r.customerName}</td>
                  <td className="px-3 py-2">{r.loanNumber}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2 text-right">{r.debit ? money(r.debit) : '—'}</td>
                  <td className="px-3 py-2 text-right">{r.credit ? money(r.credit) : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 500 && (
        <p className="px-4 py-2 text-xs text-slate-500">Showing first 500 rows — export CSV for the full set.</p>
      )}
    </ReportChrome>
  )
}
