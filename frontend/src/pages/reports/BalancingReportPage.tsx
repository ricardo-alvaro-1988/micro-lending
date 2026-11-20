import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { StatusTag } from '../../components/StatusTag'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type AgentRow = {
  agentUserId?: string | null
  agentName: string
  branchName?: string | null
  paymentCount: number
  collected: number
  remittanceCount: number
  remitted: number
  remittanceSlipCollected: number
  variance: number
  draftRemitted: number
  submittedRemitted: number
  receivedRemitted: number
  discrepancyRemitted: number
}

type RemittanceLine = {
  remittanceId: number
  remittanceDate: string
  agentName: string
  branchName?: string | null
  collected: number
  remitted: number
  variance: number
  status: string
  receivedByName?: string | null
  receivedAt?: string | null
}

type Result = {
  from: string
  to: string
  totalCollected: number
  totalRemitted: number
  totalVariance: number
  paymentCount: number
  remittanceCount: number
  agents: AgentRow[]
  remittanceLines: RemittanceLine[]
}

function varianceClass(n: number) {
  if (Math.abs(n) < 0.005) return 'text-emerald-700'
  if (n > 0) return 'text-amber-700'
  return 'text-rose-700'
}

export function BalancingReportPage() {
  const { filterBranchId, agents } = useReportFilters()
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [agentUserId, setAgentUserId] = useState('')
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to })
      if (agentUserId) qs.set('agentUserId', agentUserId)
      setData(await api<Result>(withBranchQuery(`/api/reports/balancing?${qs}`, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, agentUserId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const agentsRows = data?.agents ?? []
  const lines = data?.remittanceLines ?? []

  return (
    <ReportChrome
      title="Balancing report"
      description="Collected (field payments) and Remitted (cash to office) are shown as separate columns — never combined into one figure."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() => {
        downloadCsv(
          `balancing-agents-${from}_${to}.csv`,
          [
            'Agent',
            'Branch',
            'Payments',
            'Collected',
            'Remittance slips',
            'Remitted',
            'Slip collected (cross-check)',
            'Variance (collected − remitted)',
            'Draft remitted',
            'Submitted remitted',
            'Received remitted',
            'Discrepancy remitted',
          ],
          agentsRows.map((r) => [
            r.agentName,
            r.branchName,
            r.paymentCount,
            r.collected,
            r.remittanceCount,
            r.remitted,
            r.remittanceSlipCollected,
            r.variance,
            r.draftRemitted,
            r.submittedRemitted,
            r.receivedRemitted,
            r.discrepancyRemitted,
          ]),
        )
      }}
      filters={
        <div className="flex flex-wrap gap-3">
          <FilterField label="From">
            <input className={filterClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FilterField>
          <FilterField label="To">
            <input className={filterClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FilterField>
          <FilterField label="Agent">
            <select className={filterClass} value={agentUserId} onChange={(e) => setAgentUserId(e.target.value)}>
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
        data ? (
          <ReportSummary>
            <ReportStat
              label="Collected (payments)"
              value={money(data.totalCollected)}
              hint={`${data.paymentCount} payment${data.paymentCount === 1 ? '' : 's'}`}
            />
            <ReportStat
              label="Remitted (to office)"
              value={money(data.totalRemitted)}
              hint={`${data.remittanceCount} remittance${data.remittanceCount === 1 ? '' : 's'}`}
            />
            <ReportStat
              label="Variance (collected − remitted)"
              value={money(data.totalVariance)}
              tone={Math.abs(data.totalVariance) < 0.005 ? 'good' : data.totalVariance > 0 ? 'neutral' : 'bad'}
              hint={
                Math.abs(data.totalVariance) < 0.005
                  ? 'Balanced'
                  : data.totalVariance > 0
                    ? 'Still with agents / not remitted'
                    : 'Remitted more than collected'
              }
            />
          </ReportSummary>
        ) : null
      }
    >
      <div className="balancing-print-root space-y-8 p-4 print:p-0">
        <div className="hidden print:block print:mb-3">
          <h1 className="text-center text-base font-bold uppercase tracking-wide">Balancing report</h1>
          <p className="text-center text-[11px] text-slate-600">
            {from === to ? from : `${from} → ${to}`}
          </p>
          {data && (
            <div className="mt-2 grid grid-cols-3 gap-3 text-center text-[11px]">
              <div className="rounded border border-slate-300 p-2">
                <div className="font-semibold uppercase text-slate-500">Collected</div>
                <div className="tabular-nums font-semibold">{money(data.totalCollected)}</div>
              </div>
              <div className="rounded border border-slate-300 p-2">
                <div className="font-semibold uppercase text-slate-500">Remitted</div>
                <div className="tabular-nums font-semibold">{money(data.totalRemitted)}</div>
              </div>
              <div className="rounded border border-slate-300 p-2">
                <div className="font-semibold uppercase text-slate-500">Variance</div>
                <div className={`tabular-nums font-semibold ${varianceClass(data.totalVariance)}`}>
                  {money(data.totalVariance)}
                </div>
              </div>
            </div>
          )}
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">By agent</h2>
          <p className="text-xs text-slate-500 print:hidden">
            <strong>Collected</strong> = payments the agent recorded.&nbsp;
            <strong>Remitted</strong> = cash turned in on remittance slips (separate column).
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="border border-slate-200 px-3 py-2">Agent</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Payments</th>
                  <th className="border border-slate-200 px-3 py-2 text-right bg-sky-50 text-sky-800">
                    Collected
                  </th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Slips</th>
                  <th className="border border-slate-200 px-3 py-2 text-right bg-violet-50 text-violet-800">
                    Remitted
                  </th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Variance</th>
                  <th className="border border-slate-200 px-3 py-2 text-right print:hidden">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentsRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      No collections or remittances in this period.
                    </td>
                  </tr>
                ) : (
                  agentsRows.map((r) => (
                    <tr key={r.agentUserId ?? r.agentName} className="break-inside-avoid">
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="font-medium">{r.agentName}</div>
                        <div className="text-xs text-slate-500">{r.branchName || '—'}</div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {r.paymentCount}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums bg-sky-50/40 font-medium">
                        {money(r.collected)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {r.remittanceCount}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums bg-violet-50/40 font-medium">
                        {money(r.remitted)}
                      </td>
                      <td
                        className={`border border-slate-200 px-3 py-2 text-right tabular-nums font-medium ${varianceClass(r.variance)}`}
                      >
                        {money(r.variance)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums print:hidden">
                        {money(r.receivedRemitted)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data && agentsRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-200 px-3 py-2">Total</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {data.paymentCount}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums bg-sky-50">
                      {money(data.totalCollected)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {data.remittanceCount}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums bg-violet-50">
                      {money(data.totalRemitted)}
                    </td>
                    <td
                      className={`border border-slate-200 px-3 py-2 text-right tabular-nums ${varianceClass(data.totalVariance)}`}
                    >
                      {money(data.totalVariance)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <section className="space-y-2 break-before-page">
          <h2 className="text-sm font-semibold text-slate-800">Remittance slips (detail)</h2>
          <p className="text-xs text-slate-500 print:hidden">
            Each slip lists <strong>Collected</strong> and <strong>Remitted</strong> as separate amounts.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="border border-slate-200 px-3 py-2">Date</th>
                  <th className="border border-slate-200 px-3 py-2">Agent</th>
                  <th className="border border-slate-200 px-3 py-2 text-right bg-sky-50 text-sky-800">
                    Collected
                  </th>
                  <th className="border border-slate-200 px-3 py-2 text-right bg-violet-50 text-violet-800">
                    Remitted
                  </th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Variance</th>
                  <th className="border border-slate-200 px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      No remittance slips in this period.
                    </td>
                  </tr>
                ) : (
                  lines.map((r) => (
                    <tr key={r.remittanceId} className="break-inside-avoid">
                      <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                        {r.remittanceDate.slice(0, 10)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="font-medium">{r.agentName}</div>
                        <div className="text-xs text-slate-500">{r.branchName || '—'}</div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums bg-sky-50/40">
                        {money(r.collected)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums bg-violet-50/40 font-medium">
                        {money(r.remitted)}
                      </td>
                      <td
                        className={`border border-slate-200 px-3 py-2 text-right tabular-nums font-medium ${varianceClass(r.variance)}`}
                      >
                        {money(r.variance)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <StatusTag status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ReportChrome>
  )
}
