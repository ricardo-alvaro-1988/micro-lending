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
  accruedInterest: number
  collectedInterest: number
  variance: number
}
type Result = {
  accruedInterest: number
  collectedInterest: number
  variance: number
  rows: Row[]
}

export function InterestIncomeReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [from, setFrom] = useState(todayIso())
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
      setData(await api<Result>(withBranchQuery(`/api/reports/interest-income?${qs}`, filterBranchId)))
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
  const totals = useMemo(() => {
    let accrued = 0
    let collected = 0
    let variance = 0
    for (const r of rows) {
      accrued += r.accruedInterest
      collected += r.collectedInterest
      variance += r.variance
    }
    return { accrued, collected, variance }
  }, [rows])

  return (
    <ReportChrome
      title="Interest income"
      description="Schedule interest accrued on dues in the period vs pro-rata collected."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `interest-income-${from}_${to}.csv`,
          ['Customer', 'Agent', 'Loan', 'Accrued', 'Collected', 'Variance'],
          rows.map((r) => [r.customerName, r.agent1Name, r.loanNumber, r.accruedInterest, r.collectedInterest, r.variance]),
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
          <ReportStat label="Loans" value={String(rows.length)} />
          <ReportStat label="Interest accrued" value={money(totals.accrued)} />
          <ReportStat label="Interest collected" value={money(totals.collected)} tone="good" />
          <ReportStat
            label="Variance"
            value={money(totals.variance)}
            tone={totals.variance < 0 ? 'bad' : totals.variance > 0 ? 'good' : 'neutral'}
          />
        </ReportSummary>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Loan</th>
              <th className="px-3 py-2 text-right">Accrued</th>
              <th className="px-3 py-2 text-right">Collected</th>
              <th className="px-3 py-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No interest activity in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.loanId}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.agent1Name || '—'}</div>
                  </td>
                  <td className="px-3 py-2">{r.loanNumber}</td>
                  <td className="px-3 py-2 text-right">{money(r.accruedInterest)}</td>
                  <td className="px-3 py-2 text-right">{money(r.collectedInterest)}</td>
                  <td className="px-3 py-2 text-right">{money(r.variance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
