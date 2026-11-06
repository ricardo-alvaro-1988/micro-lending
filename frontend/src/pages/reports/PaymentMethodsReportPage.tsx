import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Method = { method: string; paymentCount: number; totalAmount: number }
type Result = { grandTotal: number; methods: Method[] }

export function PaymentMethodsReportPage() {
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
      setData(await api<Result>(withBranchQuery(`/api/reports/payment-methods?${qs}`, filterBranchId)))
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

  const methods = data?.methods ?? []
  const totals = useMemo(() => {
    let amount = 0
    let payments = 0
    for (const m of methods) {
      amount += m.totalAmount
      payments += m.paymentCount
    }
    return { amount, payments }
  }, [methods])

  return (
    <ReportChrome
      title="Payment methods"
      description="Cash vs other methods — count and total amount for the period."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `payment-methods-${from}_${to}.csv`,
          ['Method', 'Count', 'Total', 'Share %'],
          methods.map((m) => [
            m.method,
            m.paymentCount,
            m.totalAmount,
            data && data.grandTotal > 0 ? ((m.totalAmount / data.grandTotal) * 100).toFixed(2) : '0',
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
          <ReportStat label="Methods" value={String(methods.length)} hint={`${totals.payments} payment(s)`} />
          <ReportStat label="Total amount" value={money(data?.grandTotal ?? totals.amount)} />
        </ReportSummary>
      }
    >
      {data && (
        <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
          Grand total {money(data.grandTotal)}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2 text-right">Payments</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {methods.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  No payments in this range.
                </td>
              </tr>
            ) : (
              methods.map((m) => (
                <tr key={m.method}>
                  <td className="px-3 py-2 font-medium">{m.method}</td>
                  <td className="px-3 py-2 text-right">{m.paymentCount}</td>
                  <td className="px-3 py-2 text-right">{money(m.totalAmount)}</td>
                  <td className="px-3 py-2 text-right">
                    {data && data.grandTotal > 0
                      ? `${((m.totalAmount / data.grandTotal) * 100).toFixed(1)}%`
                      : '—'}
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
