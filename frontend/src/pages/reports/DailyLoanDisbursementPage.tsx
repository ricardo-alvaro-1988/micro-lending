import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  agent1Name?: string | null
  groupName?: string | null
  branchName?: string | null
  releasedAt: string
  amount: number
  totalPayable: number
  status: string
  totalDeductions?: number
  netProceeds?: number
  interestAmount?: number
  termCount?: number
  paymentFrequency?: string
}

type DayBlock = {
  dayKey: string
  label: string
  rows: Row[]
  principal: number
  deductions: number
  net: number
  payable: number
}

function dayKeyOf(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function DailyLoanDisbursementPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [mode, setMode] = useState<'date' | 'range'>('date')
  const [asOf, setAsOf] = useState(todayIso())
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [agent1UserId, setAgent1UserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const rangeFrom = mode === 'date' ? asOf : from
  const rangeTo = mode === 'date' ? asOf : to

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo })
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (groupId) qs.set('groupId', groupId)
      setRows(await api<Row[]>(withBranchQuery(`/api/reports/loan-releases?${qs}`, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [rangeFrom, rangeTo, agent1UserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const days = useMemo(() => {
    const map = new Map<string, DayBlock>()
    for (const r of rows) {
      const key = dayKeyOf(r.releasedAt)
      let block = map.get(key)
      if (!block) {
        block = {
          dayKey: key,
          label: dayLabel(key),
          rows: [],
          principal: 0,
          deductions: 0,
          net: 0,
          payable: 0,
        }
        map.set(key, block)
      }
      const deductions = r.totalDeductions ?? 0
      const net = r.netProceeds ?? Math.max(0, r.amount - deductions)
      block.rows.push(r)
      block.principal += r.amount
      block.deductions += deductions
      block.net += net
      block.payable += r.totalPayable
    }
    return [...map.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey))
  }, [rows])

  const totals = useMemo(() => {
    return days.reduce(
      (acc, d) => ({
        count: acc.count + d.rows.length,
        principal: acc.principal + d.principal,
        deductions: acc.deductions + d.deductions,
        net: acc.net + d.net,
        payable: acc.payable + d.payable,
      }),
      { count: 0, principal: 0, deductions: 0, net: 0, payable: 0 },
    )
  }, [days])

  const periodLabel =
    rangeFrom === rangeTo
      ? dayLabel(rangeFrom)
      : `${dayLabel(rangeFrom)} → ${dayLabel(rangeTo)}`

  return (
    <ReportChrome
      title="Daily loan disbursement"
      description="Printable list of loans released / disbursed by date or date range."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `loan-disbursement-${rangeFrom}_${rangeTo}.csv`,
          [
            'Released',
            'Customer',
            'Group',
            'Agent',
            'Branch',
            'Loan',
            'Principal',
            'Deductions',
            'Net disbursed',
            'Total payable',
            'Terms',
            'Status',
          ],
          rows.map((r) => [
            r.releasedAt,
            r.customerName,
            r.groupName,
            r.agent1Name,
            r.branchName,
            r.loanNumber,
            r.amount,
            r.totalDeductions ?? 0,
            r.netProceeds ?? Math.max(0, r.amount - (r.totalDeductions ?? 0)),
            r.totalPayable,
            `${r.termCount ?? ''} ${r.paymentFrequency ?? ''}`.trim(),
            r.status,
          ]),
        )
      }
      filters={
        <div className="flex flex-wrap gap-3">
          <FilterField label="Filter mode">
            <select
              className={filterClass}
              value={mode}
              onChange={(e) => setMode(e.target.value === 'range' ? 'range' : 'date')}
            >
              <option value="date">By date</option>
              <option value="range">By range</option>
            </select>
          </FilterField>
          {mode === 'date' ? (
            <FilterField label="Date">
              <input className={filterClass} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </FilterField>
          ) : (
            <>
              <FilterField label="From">
                <input className={filterClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </FilterField>
              <FilterField label="To">
                <input className={filterClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </FilterField>
            </>
          )}
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
          <ReportStat label="Loans" value={String(totals.count)} />
          <ReportStat label="Principal" value={money(totals.principal)} />
          <ReportStat label="Net disbursed" value={money(totals.net)} />
          <ReportStat label="Total payable" value={money(totals.payable)} />
        </ReportSummary>
      }
    >
      <div className="disbursement-print-root space-y-6 p-4 print:p-0">
        <div className="hidden print:block print:mb-3">
          <h1 className="text-center text-base font-bold uppercase tracking-wide">
            Daily loan disbursement
          </h1>
          <p className="text-center text-[11px] text-slate-600">{periodLabel}</p>
          <p className="mt-1 text-center text-[11px] text-slate-600">
            Loans: {totals.count} · Principal: {money(totals.principal)} · Net disbursed:{' '}
            {money(totals.net)} · Payable: {money(totals.payable)}
          </p>
        </div>

        {days.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-slate-500">No disbursements in this period.</p>
        ) : (
          days.map((day, dayIndex) => (
            <section
              key={day.dayKey}
              className={`break-inside-avoid space-y-2 ${dayIndex > 0 ? 'break-before-page' : ''}`}
            >
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-300 pb-1">
                <h2 className="text-sm font-semibold text-slate-900">{day.label}</h2>
                <div className="text-xs text-slate-600">
                  {day.rows.length} loan{day.rows.length === 1 ? '' : 's'} · Net {money(day.net)}
                </div>
              </div>

              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-300 px-1.5 py-1 font-semibold">#</th>
                    <th className="border border-slate-300 px-1.5 py-1 font-semibold">Time</th>
                    <th className="border border-slate-300 px-1.5 py-1 font-semibold">Customer</th>
                    <th className="border border-slate-300 px-1.5 py-1 font-semibold">Group / Agent</th>
                    <th className="border border-slate-300 px-1.5 py-1 font-semibold">Loan</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Principal</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Deductions</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Net</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Payable</th>
                    <th className="border border-slate-300 px-1.5 py-1 font-semibold">Received by</th>
                  </tr>
                </thead>
                <tbody>
                  {day.rows.map((r, i) => {
                    const deductions = r.totalDeductions ?? 0
                    const net = r.netProceeds ?? Math.max(0, r.amount - deductions)
                    return (
                      <tr key={r.loanId} className="break-inside-avoid">
                        <td className="border border-slate-300 px-1.5 py-1">{i + 1}</td>
                        <td className="border border-slate-300 px-1.5 py-1 whitespace-nowrap">
                          {new Date(r.releasedAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1 font-medium">{r.customerName}</td>
                        <td className="border border-slate-300 px-1.5 py-1">
                          <div>{r.groupName || '—'}</div>
                          <div className="text-[10px] text-slate-500">{r.agent1Name || '—'}</div>
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1">
                          <div>{r.loanNumber}</div>
                          <div className="text-[10px] text-slate-500">
                            {r.termCount ? `${r.termCount}× ${r.paymentFrequency || ''}` : '—'}
                          </div>
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                          {money(r.amount)}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                          {money(deductions)}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums font-medium">
                          {money(net)}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                          {money(r.totalPayable)}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1">
                          <div className="h-5 border-b border-slate-400" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-300 px-1.5 py-1" colSpan={5}>
                      Day total
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                      {money(day.principal)}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                      {money(day.deductions)}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                      {money(day.net)}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                      {money(day.payable)}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1" />
                  </tr>
                </tfoot>
              </table>
            </section>
          ))
        )}

        {days.length > 1 && (
          <div className="break-inside-avoid border-t border-slate-400 pt-2 text-xs font-semibold">
            Period total — Loans: {totals.count} · Principal: {money(totals.principal)} · Deductions:{' '}
            {money(totals.deductions)} · Net disbursed: {money(totals.net)} · Payable:{' '}
            {money(totals.payable)}
          </div>
        )}

        <div className="hidden grid-cols-3 gap-8 pt-10 print:grid">
          <div className="text-center">
            <div className="mx-auto mb-1 h-8 w-4/5 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">Prepared by</div>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 h-8 w-4/5 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">Checked by</div>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 h-8 w-4/5 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">Approved by</div>
          </div>
        </div>
      </div>
    </ReportChrome>
  )
}
