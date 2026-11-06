import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  loanId: number
  loanNumber: string
  customerName: string
  agent1Name?: string | null
  groupName?: string | null
  status: string
  closedAt: string
  closeReason: string
  totalPayable: number
  totalPaid: number
}

export function ClosedLoansReportPage() {
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
      setRows(await api<Row[]>(withBranchQuery(`/api/reports/closed-loans?${qs}`, filterBranchId)))
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
    let payable = 0
    let paid = 0
    for (const r of rows) {
      payable += r.totalPayable
      paid += r.totalPaid
    }
    return { payable, paid }
  }, [rows])

  return (
    <ReportChrome
      title="Closed / matured loans"
      description="Loans closed in the period, or fully paid with last payment in the period."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `closed-loans-${from}_${to}.csv`,
          ['Closed at', 'Reason', 'Customer', 'Agent', 'Group', 'Loan', 'Payable', 'Paid', 'Status'],
          rows.map((r) => [
            r.closedAt,
            r.closeReason,
            r.customerName,
            r.agent1Name,
            r.groupName,
            r.loanNumber,
            r.totalPayable,
            r.totalPaid,
            r.status,
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
          <ReportStat label="Closed" value={String(rows.length)} />
          <ReportStat label="Total payable" value={money(totals.payable)} />
          <ReportStat label="Total paid" value={money(totals.paid)} tone="good" />
        </ReportSummary>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Closed</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Loan</th>
              <th className="px-3 py-2 text-right">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No closed or matured loans in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.loanId}-${r.closedAt}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.closedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.closeReason}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.agent1Name || '—'}</div>
                  </td>
                  <td className="px-3 py-2">{r.loanNumber}</td>
                  <td className="px-3 py-2 text-right">{money(r.totalPaid)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
