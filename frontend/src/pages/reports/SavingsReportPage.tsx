import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  transactionId: number
  occurredAt: string
  customerId: number
  customerName: string
  groupName?: string | null
  loanId: number
  loanNumber: string
  kind: string
  type: string
  amount: number
  balanceAfter: number
  notes?: string | null
  recordedBy?: string | null
}

function monthAgoIso() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export function PrimarySavingsReportPage() {
  return <SavingsReportPage kind="Primary" title="Primary savings" description="Initial savings ledger (primary)." />
}

export function ExtraSavingsReportPage() {
  return (
    <SavingsReportPage
      kind="Extra"
      title="Extra savings"
      description="Daily / period savings ledger and underpay offsets."
    />
  )
}

function SavingsReportPage({
  kind,
  title,
  description,
}: {
  kind: 'Primary' | 'Extra'
  title: string
  description: string
}) {
  const { filterBranchId, groups } = useReportFilters()
  const [from, setFrom] = useState(monthAgoIso)
  const [to, setTo] = useState(todayIso)
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ kind, from, to })
      if (groupId) qs.set('groupId', groupId)
      setRows(await api<Row[]>(withBranchQuery(`/api/reports/savings?${qs}`, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [kind, from, to, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    let credits = 0
    let debits = 0
    for (const r of rows) {
      if (r.amount >= 0) credits += r.amount
      else debits += Math.abs(r.amount)
    }
    return { credits, debits, net: credits - debits, count: rows.length }
  }, [rows])

  return (
    <ReportChrome
      title={title}
      description={description}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `${kind.toLowerCase()}-savings-${from}_${to}.csv`,
          ['Occurred', 'Customer', 'Group', 'Loan', 'Type', 'Amount', 'Balance after', 'Notes', 'Recorded by'],
          rows.map((r) => [
            r.occurredAt,
            r.customerName,
            r.groupName,
            r.loanNumber,
            r.type,
            r.amount,
            r.balanceAfter,
            r.notes,
            r.recordedBy,
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
          <ReportStat label="Entries" value={String(totals.count)} />
          <ReportStat label="Credits" value={money(totals.credits)} tone="good" />
          <ReportStat label="Debits" value={money(totals.debits)} />
          <ReportStat label="Net" value={money(totals.net)} />
        </ReportSummary>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Occurred</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Loan</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
              <th className="px-3 py-2 font-medium text-right">Balance</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No savings transactions in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.transactionId} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{r.occurredAt.slice(0, 19).replace('T', ' ')}</td>
                  <td className="px-3 py-2">
                    <div>{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.groupName || '—'}</div>
                  </td>
                  <td className="px-3 py-2">{r.loanNumber}</td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className={`px-3 py-2 text-right ${r.amount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {money(r.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">{money(r.balanceAfter)}</td>
                  <td className="px-3 py-2 text-slate-600">{r.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
