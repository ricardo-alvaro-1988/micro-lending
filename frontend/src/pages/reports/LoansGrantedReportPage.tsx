import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { StatusTag } from '../../components/StatusTag'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type GroupRow = {
  name: string
  loanCount: number
  principal: number
  interestAmount: number
  totalPayable: number
  netProceeds: number
}

type LoanRow = {
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  agent1Name?: string | null
  groupName?: string | null
  branchName?: string | null
  loanProductName?: string | null
  grantedAt: string
  principal: number
  interestAmount: number
  totalPayable: number
  netProceeds: number
  status: string
  termCount: number
  paymentFrequency: string
}

type Result = {
  from?: string | null
  to?: string | null
  loanCount: number
  totalPrincipal: number
  totalInterest: number
  totalPayable: number
  totalNetProceeds: number
  byAgent: GroupRow[]
  byProduct: GroupRow[]
  loans: LoanRow[]
}

export function LoansGrantedReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [allTime, setAllTime] = useState(false)
  const [from, setFrom] = useState(todayIso().slice(0, 8) + '01')
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
      const qs = new URLSearchParams()
      if (!allTime) {
        qs.set('from', from)
        qs.set('to', to)
      }
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (groupId) qs.set('groupId', groupId)
      const q = qs.toString()
      setData(
        await api<Result>(
          withBranchQuery(`/api/reports/loans-granted${q ? `?${q}` : ''}`, filterBranchId),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [allTime, from, to, agent1UserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const loans = data?.loans ?? []
  const periodLabel = allTime
    ? 'All time'
    : from === to
      ? from
      : `${from} → ${to}`

  return (
    <ReportChrome
      title="Loan granted report"
      description="Overall loans granted (approved-final / closed) — principal, interest, and net proceeds."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `loans-granted-${allTime ? 'all' : `${from}_${to}`}.csv`,
          [
            'Granted',
            'Customer',
            'Agent',
            'Group',
            'Branch',
            'Product',
            'Loan',
            'Principal',
            'Interest',
            'Payable',
            'Net proceeds',
            'Terms',
            'Status',
          ],
          loans.map((r) => [
            r.grantedAt,
            r.customerName,
            r.agent1Name,
            r.groupName,
            r.branchName,
            r.loanProductName,
            r.loanNumber,
            r.principal,
            r.interestAmount,
            r.totalPayable,
            r.netProceeds,
            `${r.termCount}× ${r.paymentFrequency}`,
            r.status,
          ]),
        )
      }
      filters={
        <div className="flex flex-wrap gap-3">
          <FilterField label="Period">
            <select
              className={filterClass}
              value={allTime ? 'all' : 'range'}
              onChange={(e) => setAllTime(e.target.value === 'all')}
            >
              <option value="range">By date range</option>
              <option value="all">All time</option>
            </select>
          </FilterField>
          {!allTime && (
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
          <ReportStat label="Loans granted" value={String(data?.loanCount ?? 0)} />
          <ReportStat label="Principal granted" value={money(data?.totalPrincipal ?? 0)} />
          <ReportStat label="Interest" value={money(data?.totalInterest ?? 0)} />
          <ReportStat label="Net proceeds" value={money(data?.totalNetProceeds ?? 0)} />
        </ReportSummary>
      }
    >
      <div className="loans-granted-print-root space-y-6 p-4 print:p-0">
        <div className="hidden print:block print:mb-3">
          <h1 className="text-center text-base font-bold uppercase tracking-wide">Loan granted report</h1>
          <p className="text-center text-[11px] text-slate-600">{periodLabel}</p>
          {data && (
            <p className="mt-1 text-center text-[11px] text-slate-600">
              Loans: {data.loanCount} · Principal: {money(data.totalPrincipal)} · Interest:{' '}
              {money(data.totalInterest)} · Payable: {money(data.totalPayable)} · Net:{' '}
              {money(data.totalNetProceeds)}
            </p>
          )}
        </div>

        {(data?.byAgent.length ?? 0) > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">By agent</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2">Agent</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Loans</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Principal</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Interest</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Net proceeds</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byAgent ?? []).map((a) => (
                    <tr key={a.name} className="break-inside-avoid">
                      <td className="border border-slate-200 px-3 py-2 font-medium">{a.name}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{a.loanCount}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-medium">
                        {money(a.principal)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(a.interestAmount)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(a.netProceeds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(data?.byProduct.length ?? 0) > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">By product</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2">Product</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Loans</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Principal</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Interest</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Net proceeds</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byProduct ?? []).map((p) => (
                    <tr key={p.name} className="break-inside-avoid">
                      <td className="border border-slate-200 px-3 py-2 font-medium">{p.name}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{p.loanCount}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-medium">
                        {money(p.principal)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(p.interestAmount)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(p.netProceeds)}
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
                  <th className="border border-slate-200 px-3 py-2">Granted</th>
                  <th className="border border-slate-200 px-3 py-2">Customer</th>
                  <th className="border border-slate-200 px-3 py-2">Loan</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Principal</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Interest</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Payable</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Net</th>
                  <th className="border border-slate-200 px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      No loans granted for these filters.
                    </td>
                  </tr>
                ) : (
                  loans.map((r) => (
                    <tr key={r.loanId} className="break-inside-avoid">
                      <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                        {new Date(r.grantedAt).toLocaleDateString()}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="font-medium">{r.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {r.agent1Name || '—'}
                          {r.groupName ? ` · ${r.groupName}` : ''}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <div>{r.loanNumber}</div>
                        <div className="text-xs text-slate-500">
                          {r.loanProductName || '—'} · {r.termCount}× {r.paymentFrequency}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-medium">
                        {money(r.principal)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(r.interestAmount)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(r.totalPayable)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                        {money(r.netProceeds)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <StatusTag status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data && loans.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-200 px-3 py-2" colSpan={3}>
                      Total ({data.loanCount})
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {money(data.totalPrincipal)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {money(data.totalInterest)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {money(data.totalPayable)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                      {money(data.totalNetProceeds)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2" />
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
