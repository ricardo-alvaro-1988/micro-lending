import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  agent1UserId?: string | null
  agent1Name: string
  customerCount: number
  loanCount: number
  expectedDue: number
  collected: number
  variance: number
}

export function AgentCollectionsReportPage() {
  const { filterBranchId, agents } = useReportFilters()
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [agent1UserId, setAgent1UserId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to })
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      setRows(
        await api<Row[]>(withBranchQuery(`/api/reports/agent-collections?${qs}`, filterBranchId)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to, agent1UserId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    let expected = 0
    let collected = 0
    let variance = 0
    for (const r of rows) {
      expected += r.expectedDue
      collected += r.collected
      variance += r.variance
    }
    return { expected, collected, variance }
  }, [rows])

  return (
    <ReportChrome
      title="Agent collections"
      description="Schedule amount due in the period vs payments collected, by Agent 1."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `agent-collections-${from}_${to}.csv`,
          ['Agent', 'Customers', 'Loans due', 'Expected', 'Collected', 'Variance'],
          rows.map((r) => [
            r.agent1Name,
            r.customerCount,
            r.loanCount,
            r.expectedDue,
            r.collected,
            r.variance,
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
        </div>
      }
      summary={
        <ReportSummary>
          <ReportStat label="Agents" value={String(rows.length)} />
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
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2 text-right">Customers</th>
              <th className="px-3 py-2 text-right">Loans</th>
              <th className="px-3 py-2 text-right">Expected</th>
              <th className="px-3 py-2 text-right">Collected</th>
              <th className="px-3 py-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No agent collection data for this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.agent1UserId ?? r.agent1Name}>
                  <td className="px-3 py-2 font-medium">{r.agent1Name}</td>
                  <td className="px-3 py-2 text-right">{r.customerCount}</td>
                  <td className="px-3 py-2 text-right">{r.loanCount}</td>
                  <td className="px-3 py-2 text-right">{money(r.expectedDue)}</td>
                  <td className="px-3 py-2 text-right">{money(r.collected)}</td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      r.variance < 0 ? 'text-red-600' : r.variance > 0 ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {money(r.variance)}
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
