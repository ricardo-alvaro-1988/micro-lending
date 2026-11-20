import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { formatPhDateTime } from '../../lib/phDate'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  paymentId: number
  paidAt: string
  amount: number
  extraSavingsOffset?: number
  method?: string | null
  reference?: string | null
  recordedBy: string
  customerName: string
  agent1Name?: string | null
  loanNumber: string
  branchName?: string | null
}

export function PaymentRegisterReportPage() {
  const { filterBranchId, agents } = useReportFilters()
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [method, setMethod] = useState('')
  const [agent1UserId, setAgent1UserId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to })
      if (method) qs.set('method', method)
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      setRows(
        await api<Row[]>(withBranchQuery(`/api/reports/payment-register?${qs}`, filterBranchId)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to, method, agent1UserId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    let cash = 0
    let cashMethod = 0
    let applied = 0
    let offset = 0
    for (const r of rows) {
      const extra = r.extraSavingsOffset ?? 0
      cash += r.amount
      offset += extra
      applied += r.amount + extra
      if ((r.method ?? '').toLowerCase() === 'cash') cashMethod += r.amount
    }
    return { cash, cashMethod, applied, offset }
  }, [rows])

  return (
    <ReportChrome
      title="Payment register"
      description="Posted payments for the selected period. Amount is cash received; extra savings offset is separate."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `payment-register-${from}_${to}.csv`,
          [
            'Paid at',
            'Cash amount',
            'Extra savings offset',
            'Applied',
            'Method',
            'Reference',
            'Recorded by',
            'Customer',
            'Agent',
            'Loan',
            'Branch',
          ],
          rows.map((r) => {
            const extra = r.extraSavingsOffset ?? 0
            return [
              r.paidAt,
              r.amount,
              extra,
              r.amount + extra,
              r.method,
              r.reference,
              r.recordedBy,
              r.customerName,
              r.agent1Name,
              r.loanNumber,
              r.branchName,
            ]
          }),
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
          <FilterField label="Method">
            <input
              className={filterClass}
              placeholder="e.g. Cash"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
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
          <ReportStat label="Payments" value={String(rows.length)} />
          <ReportStat label="Cash total" value={money(totals.cashMethod)} hint="method = Cash" />
          <ReportStat label="Applied total" value={money(totals.applied)} hint="cash + extra offset" />
        </ReportSummary>
      }
    >
      <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
        {rows.length} payment(s) · cash {money(totals.cash)}
        {totals.offset > 0 ? ` · offset ${money(totals.offset)} · applied ${money(totals.applied)}` : ''}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Paid at</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Loan</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Recorded by</th>
              <th className="px-3 py-2 text-right">Cash</th>
              <th className="px-3 py-2 text-right">Offset</th>
              <th className="px-3 py-2 text-right">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No payments in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const extra = r.extraSavingsOffset ?? 0
                return (
                  <tr key={r.paymentId}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatPhDateTime(r.paidAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.customerName}</div>
                      <div className="text-xs text-slate-500">{r.agent1Name || '—'}</div>
                    </td>
                    <td className="px-3 py-2">{r.loanNumber}</td>
                    <td className="px-3 py-2">{r.method || '—'}</td>
                    <td className="px-3 py-2">{r.recordedBy}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(r.amount)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{extra > 0 ? money(extra) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(r.amount + extra)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
