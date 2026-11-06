import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Stage = { stageName: string; decidedCount: number; avgHours?: number | null; medianHours?: number | null }
type Row = {
  approvalId: number
  loanNumber: string
  customerName: string
  stageName: string
  decision: string
  requestedAt: string
  decidedAt?: string | null
  hoursToDecision?: number | null
  decidedBy?: string | null
  comments?: string | null
}
type Result = {
  pendingCount: number
  decidedCount: number
  overallAvgHours?: number | null
  byStage: Stage[]
  rows: Row[]
}

export function ApprovalTatReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(todayIso())
  const [agent1UserId, setAgent1UserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to })
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (groupId) qs.set('groupId', groupId)
      setData(await api<Result>(withBranchQuery(`/api/reports/approval-tat?${qs}`, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, agent1UserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const rows = data?.rows ?? []
  const avgTat = useMemo(() => {
    const hours = rows
      .map((r) => r.hoursToDecision)
      .filter((h): h is number => h != null && Number.isFinite(h))
    if (hours.length === 0) return data?.overallAvgHours ?? null
    return hours.reduce((s, h) => s + h, 0) / hours.length
  }, [rows, data?.overallAvgHours])

  return (
    <ReportChrome
      title="Approval pipeline / TAT"
      description="Time from approval request to decision, by stage."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `approval-tat-${from}_${to}.csv`,
          ['Requested', 'Decided', 'Hours', 'Stage', 'Decision', 'Customer', 'Loan', 'Decided by', 'Comments'],
          rows.map((r) => [
            r.requestedAt,
            r.decidedAt,
            r.hoursToDecision,
            r.stageName,
            r.decision,
            r.customerName,
            r.loanNumber,
            r.decidedBy,
            r.comments,
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
          <ReportStat label="Requests" value={String(rows.length)} />
          <ReportStat label="Pending" value={String(data?.pendingCount ?? 0)} />
          <ReportStat label="Decided" value={String(data?.decidedCount ?? 0)} />
          <ReportStat
            label="Avg TAT (h)"
            value={avgTat == null ? '—' : avgTat.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          />
        </ReportSummary>
      }
    >
      {data && data.byStage.length > 0 && (
        <div className="border-b border-slate-100 p-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Stage</th>
                  <th className="py-1 pr-3 text-right">Count</th>
                  <th className="py-1 pr-3 text-right">Avg h</th>
                  <th className="py-1 text-right">Median h</th>
                </tr>
              </thead>
              <tbody>
                {data.byStage.map((s) => (
                  <tr key={s.stageName} className="border-t border-slate-100">
                    <td className="py-1 pr-3">{s.stageName}</td>
                    <td className="py-1 pr-3 text-right">{s.decidedCount}</td>
                    <td className="py-1 pr-3 text-right">{s.avgHours ?? '—'}</td>
                    <td className="py-1 text-right">{s.medianHours ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Requested</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Decision</th>
              <th className="px-3 py-2 text-right">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No approval requests in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.approvalId}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.loanNumber}</div>
                  </td>
                  <td className="px-3 py-2">{r.stageName}</td>
                  <td className="px-3 py-2">{r.decision}</td>
                  <td className="px-3 py-2 text-right">{r.hoursToDecision ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
