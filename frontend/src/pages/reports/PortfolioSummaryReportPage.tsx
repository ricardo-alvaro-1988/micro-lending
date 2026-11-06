import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type LoanRow = {
  loanId: number
  loanNumber: string
  customerName: string
  agent1Name?: string | null
  groupName?: string | null
  branchName?: string | null
  status: string
  totalPayable: number
  totalPaid: number
  remaining: number
  overdueRemaining: number
  overdueInstallments: number
}

type Result = {
  asOf: string
  activeLoanCount: number
  totalPayable: number
  totalPaid: number
  outstanding: number
  overdueTotal: number
  overdueLoanCount: number
  loans: LoanRow[]
}

export function PortfolioSummaryReportPage() {
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
      setData(
        await api<Result>(withBranchQuery(`/api/reports/portfolio-summary?${qs}`, filterBranchId)),
      )
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
  const totals = useMemo(() => {
    let outstanding = 0
    let payable = 0
    let overdue = 0
    for (const r of loans) {
      outstanding += r.remaining
      payable += r.totalPayable
      overdue += r.overdueRemaining
    }
    return { outstanding, payable, overdue }
  }, [loans])

  return (
    <ReportChrome
      title="Portfolio summary"
      description="Approved-final loans with outstanding and overdue totals."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `portfolio-summary-${asOf}.csv`,
          [
            'Customer',
            'Agent',
            'Group',
            'Branch',
            'Loan',
            'Status',
            'Payable',
            'Paid',
            'Remaining',
            'Overdue',
            'Overdue installments',
          ],
          loans.map((r) => [
            r.customerName,
            r.agent1Name,
            r.groupName,
            r.branchName,
            r.loanNumber,
            r.status,
            r.totalPayable,
            r.totalPaid,
            r.remaining,
            r.overdueRemaining,
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
          <ReportStat label="Loans" value={String(loans.length)} />
          <ReportStat label="Outstanding" value={money(totals.outstanding)} />
          <ReportStat label="Total payable" value={money(totals.payable)} />
          <ReportStat label="Overdue" value={money(totals.overdue)} tone="bad" />
        </ReportSummary>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Loan</th>
              <th className="px-3 py-2 text-right">Remaining</th>
              <th className="px-3 py-2 text-right">Overdue</th>
              <th className="px-3 py-2 text-right"># OD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No active loans for these filters.
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
                  <td className="px-3 py-2 text-right">{money(r.remaining)}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-700">
                    {r.overdueRemaining > 0 ? money(r.overdueRemaining) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{r.overdueInstallments || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
