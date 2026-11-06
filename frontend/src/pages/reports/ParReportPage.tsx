import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Loan = {
  loanId: number
  loanNumber: string
  customerName: string
  agent1Name?: string | null
  groupName?: string | null
  outstanding: number
  maxDaysPastDue: number
  inPar1: boolean
  inPar7: boolean
  inPar30: boolean
}

type Result = {
  asOf: string
  portfolioOutstanding: number
  par1Outstanding: number
  par7Outstanding: number
  par30Outstanding: number
  par1Percent: number
  par7Percent: number
  par30Percent: number
  loans: Loan[]
}

export function ParReportPage() {
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
      setData(await api<Result>(withBranchQuery(`/api/reports/par?${qs}`, filterBranchId)))
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

  const loans = data?.loans ?? []
  const loanTotals = useMemo(() => {
    let outstanding = 0
    let par1 = 0
    let par30 = 0
    for (const r of loans) {
      outstanding += r.outstanding
      if (r.inPar1) par1 += r.outstanding
      if (r.inPar30) par30 += r.outstanding
    }
    return { outstanding, par1, par30 }
  }, [loans])

  return (
    <ReportChrome
      title="Portfolio at Risk (PAR)"
      description="Outstanding on loans with overdue installments (PAR 1 / 7 / 30)."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `par-${asOf}.csv`,
          ['Customer', 'Agent', 'Group', 'Loan', 'Outstanding', 'Max DPD', 'PAR1', 'PAR7', 'PAR30'],
          loans.map((r) => [
            r.customerName,
            r.agent1Name,
            r.groupName,
            r.loanNumber,
            r.outstanding,
            r.maxDaysPastDue,
            r.inPar1 ? 'Y' : 'N',
            r.inPar7 ? 'Y' : 'N',
            r.inPar30 ? 'Y' : 'N',
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
          <ReportStat label="PAR loans" value={String(loans.length)} />
          <ReportStat
            label="Portfolio"
            value={money(data?.portfolioOutstanding ?? loanTotals.outstanding)}
          />
          <ReportStat
            label="PAR 1"
            value={money(data?.par1Outstanding ?? loanTotals.par1)}
            hint={data ? `${data.par1Percent}%` : undefined}
            tone="bad"
          />
          <ReportStat
            label="PAR 30"
            value={money(data?.par30Outstanding ?? loanTotals.par30)}
            hint={data ? `${data.par30Percent}%` : undefined}
            tone="bad"
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
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-right">Max DPD</th>
              <th className="px-3 py-2">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No PAR loans as of this date.
                </td>
              </tr>
            ) : (
              loans.map((r) => (
                <tr key={r.loanId}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.agent1Name || '—'}</div>
                  </td>
                  <td className="px-3 py-2">{r.loanNumber}</td>
                  <td className="px-3 py-2 text-right">{money(r.outstanding)}</td>
                  <td className="px-3 py-2 text-right">{r.maxDaysPastDue}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {[r.inPar1 && 'PAR1', r.inPar7 && 'PAR7', r.inPar30 && 'PAR30'].filter(Boolean).join(' · ')}
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
