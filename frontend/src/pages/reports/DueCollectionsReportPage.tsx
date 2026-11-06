import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  scheduleItemId: number
  customerId: number
  customerName: string
  customerMobile?: string | null
  groupName?: string | null
  agent1Name?: string | null
  loanId: number
  loanNumber: string
  installmentNumber: number
  dueDate: string
  amountDue: number
  penaltyAmount: number
  paidAmount: number
  remaining: number
  isOverdue: boolean
  loanStatus: string
}

export function DueCollectionsReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [asOf, setAsOf] = useState(todayIso())
  const [agent1UserId, setAgent1UserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ asOf })
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (groupId) qs.set('groupId', groupId)
      const data = await api<Row[]>(
        withBranchQuery(`/api/reports/due-collections?${qs}`, filterBranchId),
      )
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [asOf, agent1UserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    let amountDue = 0
    let remaining = 0
    for (const r of rows) {
      amountDue += r.amountDue
      remaining += r.remaining
    }
    return { amountDue, remaining }
  }, [rows])

  return (
    <ReportChrome
      title="Daily due collections"
      description="Open installments due on or before the selected date."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `due-collections-${asOf}.csv`,
          ['Customer', 'Mobile', 'Group', 'Agent', 'Loan', 'Inst #', 'Due', 'Amount due', 'Penalty', 'Paid', 'Remaining', 'Overdue', 'Status'],
          rows.map((r) => [
            r.customerName,
            r.customerMobile,
            r.groupName,
            r.agent1Name,
            r.loanNumber,
            r.installmentNumber,
            r.dueDate.slice(0, 10),
            r.amountDue,
            r.penaltyAmount,
            r.paidAmount,
            r.remaining,
            r.isOverdue ? 'Yes' : 'No',
            r.loanStatus,
          ]),
        )
      }
      filters={
        <div className="flex flex-wrap gap-3">
          <FilterField label="As of">
            <input className={filterClass} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
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
          <ReportStat label="Rows" value={String(rows.length)} hint="Installments in result" />
          <ReportStat label="Total due" value={money(totals.amountDue)} />
          <ReportStat label="Total remaining" value={money(totals.remaining)} />
        </ReportSummary>
      }
    >
      <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
        {rows.length} installment(s) · remaining {money(totals.remaining)}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Loan</th>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2 text-right">Penalty</th>
              <th className="px-3 py-2 text-right">Remaining</th>
              <th className="px-3 py-2">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No due installments for these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.scheduleItemId}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.customerMobile || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.agent1Name || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.loanNumber}</td>
                  <td className="px-3 py-2">{r.installmentNumber}</td>
                  <td className="px-3 py-2">{new Date(r.dueDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">{r.penaltyAmount > 0 ? money(r.penaltyAmount) : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(r.remaining)}</td>
                  <td className="px-3 py-2">
                    {r.isOverdue ? (
                      <span className="text-xs font-semibold text-red-600">Overdue</span>
                    ) : (
                      <span className="text-xs text-slate-500">Due</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
