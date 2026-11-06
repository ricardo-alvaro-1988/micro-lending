import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Day = { date: string; expectedDue: number; collected: number; variance: number }
type Result = {
  from: string
  to: string
  expectedDue: number
  collected: number
  variance: number
  days: Day[]
}

export function ExpectedVsActualReportPage() {
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
      setData(
        await api<Result>(withBranchQuery(`/api/reports/expected-vs-actual?${qs}`, filterBranchId)),
      )
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

  const days = data?.days ?? []
  const totals = useMemo(() => {
    let expected = 0
    let collected = 0
    let variance = 0
    for (const d of days) {
      expected += d.expectedDue
      collected += d.collected
      variance += d.variance
    }
    return { expected, collected, variance }
  }, [days])

  return (
    <ReportChrome
      title="Expected vs actual"
      description="Schedule amount due each day versus payments collected."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `expected-vs-actual-${from}_${to}.csv`,
          ['Date', 'Expected', 'Collected', 'Variance'],
          days.map((d) => [d.date.slice(0, 10), d.expectedDue, d.collected, d.variance]),
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
          <ReportStat label="Expected" value={money(totals.expected)} />
          <ReportStat label="Collected" value={money(totals.collected)} tone="good" />
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
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Expected</th>
              <th className="px-3 py-2 text-right">Collected</th>
              <th className="px-3 py-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {days.map((d) => (
              <tr key={d.date}>
                <td className="px-3 py-2">{new Date(d.date).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">{money(d.expectedDue)}</td>
                <td className="px-3 py-2 text-right">{money(d.collected)}</td>
                <td
                  className={`px-3 py-2 text-right font-medium ${
                    d.variance < 0 ? 'text-red-600' : d.variance > 0 ? 'text-emerald-700' : ''
                  }`}
                >
                  {money(d.variance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
