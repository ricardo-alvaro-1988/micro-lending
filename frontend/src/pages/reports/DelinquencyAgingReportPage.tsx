import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Summary = { bucket: string; count: number; remainingTotal: number }
type Row = {
  scheduleItemId: number
  customerName: string
  agent1Name?: string | null
  groupName?: string | null
  loanNumber: string
  installmentNumber: number
  dueDate: string
  daysPastDue: number
  agingBucket: string
  remaining: number
}
type Result = { asOf: string; summary: Summary[]; rows: Row[] }

export function DelinquencyAgingReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [asOf, setAsOf] = useState(todayIso())
  const [agent1UserId, setAgent1UserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ asOf })
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (groupId) qs.set('groupId', groupId)
      setData(
        await api<Result>(withBranchQuery(`/api/reports/delinquency-aging?${qs}`, filterBranchId)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [asOf, agent1UserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const rows = data?.rows ?? []
  const summary = data?.summary ?? []
  const totals = useMemo(() => {
    const overdue = rows.reduce((s, r) => s + r.remaining, 0)
    const loans = new Set(rows.map((r) => r.loanNumber)).size
    return { overdue, loans }
  }, [rows])

  return (
    <ReportChrome
      title="Delinquency aging"
      description="Overdue installments by days past due."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `delinquency-aging-${asOf}.csv`,
          ['Customer', 'Agent', 'Group', 'Loan', 'Inst #', 'Due', 'Days past due', 'Bucket', 'Remaining'],
          rows.map((r) => [
            r.customerName,
            r.agent1Name,
            r.groupName,
            r.loanNumber,
            r.installmentNumber,
            r.dueDate.slice(0, 10),
            r.daysPastDue,
            r.agingBucket,
            r.remaining,
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
          <ReportStat label="Rows" value={String(rows.length)} hint={`${totals.loans} loan(s)`} />
          <ReportStat label="Total overdue" value={money(totals.overdue)} tone="bad" />
          {summary.slice(0, 2).map((s) => (
            <ReportStat
              key={s.bucket}
              label={`${s.bucket} days`}
              value={money(s.remainingTotal)}
              hint={`${s.count} item(s)`}
            />
          ))}
        </ReportSummary>
      }
    >
      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 md:grid-cols-4">
        {summary.map((s) => (
          <div key={s.bucket} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {s.bucket} days
            </div>
            <div className="text-sm font-semibold text-slate-900">{money(s.remainingTotal)}</div>
            <div className="text-xs text-slate-500">{s.count} item(s)</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Loan</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2">Bucket</th>
              <th className="px-3 py-2 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No overdue installments.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.scheduleItemId}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.agent1Name || '—'}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.loanNumber} #{r.installmentNumber}
                  </td>
                  <td className="px-3 py-2">{new Date(r.dueDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">{r.daysPastDue}</td>
                  <td className="px-3 py-2">{r.agingBucket}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(r.remaining)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
