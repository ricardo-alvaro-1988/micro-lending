import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type LoanRow = {
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  agent1Name?: string | null
  groupName?: string | null
  branchName?: string | null
  status: string
  principal: number
  totalPayable: number
  totalPaid: number
  receivable: number
  currentReceivable: number
  overdueReceivable: number
  overdueInstallments: number
}

type Result = {
  asOf: string
  loanCount: number
  totalPrincipal: number
  totalPayable: number
  totalPaid: number
  totalReceivable: number
  currentReceivable: number
  overdueReceivable: number
  overdueLoanCount: number
  loans: LoanRow[]
}

export function ReceivablesReportPage() {
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
      setData(await api<Result>(withBranchQuery(`/api/reports/receivables?${qs}`, filterBranchId)))
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

  const byAgent = useMemo(() => {
    const map = new Map<string, { name: string; loans: number; receivable: number; current: number; overdue: number }>()
    for (const r of loans) {
      const key = r.agent1Name || '(Unassigned)'
      const row = map.get(key) ?? { name: key, loans: 0, receivable: 0, current: 0, overdue: 0 }
      row.loans += 1
      row.receivable += r.receivable
      row.current += r.currentReceivable
      row.overdue += r.overdueReceivable
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.receivable - a.receivable)
  }, [loans])

  return (
    <ReportChrome
      title="Receivables report"
      description="Outstanding loan balances owed by borrowers (current vs overdue) as of a date."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `receivables-${asOf}.csv`,
          [
            'Customer',
            'Agent',
            'Group',
            'Branch',
            'Loan',
            'Principal',
            'Payable',
            'Paid',
            'Receivable',
            'Current',
            'Overdue',
            'Overdue installments',
          ],
          loans.map((r) => [
            r.customerName,
            r.agent1Name,
            r.groupName,
            r.branchName,
            r.loanNumber,
            r.principal,
            r.totalPayable,
            r.totalPaid,
            r.receivable,
            r.currentReceivable,
            r.overdueReceivable,
            r.overdueInstallments,
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
          <ReportStat label="Loans with balance" value={String(data?.loanCount ?? 0)} />
          <ReportStat label="Total receivables" value={money(data?.totalReceivable ?? 0)} />
          <ReportStat label="Current" value={money(data?.currentReceivable ?? 0)} tone="good" />
          <ReportStat
            label="Overdue"
            value={money(data?.overdueReceivable ?? 0)}
            tone="bad"
            hint={`${data?.overdueLoanCount ?? 0} loan(s)`}
          />
        </ReportSummary>
      }
    >
      <div className="receivables-print-root space-y-6 p-4 print:p-0">
        <div className="hidden print:block print:mb-3">
          <h1 className="text-center text-base font-bold uppercase tracking-wide">Receivables report</h1>
          <p className="text-center text-[11px] text-slate-600">As of {asOf}</p>
          {data && (
            <p className="mt-1 text-center text-[11px] text-slate-600">
              Loans: {data.loanCount} · Receivable: {money(data.totalReceivable)} · Current:{' '}
              {money(data.currentReceivable)} · Overdue: {money(data.overdueReceivable)}
            </p>
          )}
        </div>

        {byAgent.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">By agent</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2">Agent</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Loans</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Receivable</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Current</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {byAgent.map((a) => (
                    <tr key={a.name} className="break-inside-avoid">
                      <td className="border border-slate-200 px-3 py-2 font-medium">{a.name}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{a.loans}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-medium">
                        {money(a.receivable)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-emerald-700">
                        {money(a.current)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-rose-700">
                        {money(a.overdue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">Loan detail</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="border border-slate-200 px-3 py-2">Customer</th>
                  <th className="border border-slate-200 px-3 py-2">Loan</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Principal</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Paid</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Receivable</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Current</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      No outstanding receivables for these filters.
                    </td>
                  </tr>
                ) : (
                  loans.map((r) => (
                    <tr key={r.loanId} className="break-inside-avoid">
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="font-medium">{r.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {r.agent1Name || '—'}
                          {r.groupName ? ` · ${r.groupName}` : ''}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2">{r.loanNumber}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(r.principal)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(r.totalPaid)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-medium">
                        {money(r.receivable)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-emerald-700">
                        {money(r.currentReceivable)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-rose-700">
                        {r.overdueReceivable > 0 ? money(r.overdueReceivable) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data && loans.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-200 px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {money(data.totalPrincipal)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {money(data.totalPaid)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {money(data.totalReceivable)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-emerald-700">
                      {money(data.currentReceivable)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-rose-700">
                      {money(data.overdueReceivable)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </div>
    </ReportChrome>
  )
}
