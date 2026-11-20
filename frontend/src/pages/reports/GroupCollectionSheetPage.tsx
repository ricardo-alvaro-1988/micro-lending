import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  scheduleItemId: number
  customerId: number
  customerName: string
  customerMobile?: string | null
  groupId?: number | null
  groupName?: string | null
  agent1Name?: string | null
  loanId: number
  loanNumber: string
  installmentNumber: number
  dueDate: string
  amountDue: number
  penaltyAmount: number
  paidAmount: number
  remaining: number
  loanBalance: number
  primarySavingsBalance: number
  extraSavingsBalance: number
  isOverdue: boolean
  loanStatus: string
}

type CustomerBlock = {
  customerId: number
  customerName: string
  customerMobile?: string | null
  agent1Name?: string | null
  rows: Row[]
  dayTotal: number
  loanBalance: number
  primarySavings: number
  extraSavings: number
  seenLoans: Set<number>
}

export function GroupCollectionSheetPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [asOf, setAsOf] = useState(todayIso())
  const [groupId, setGroupId] = useState('')
  const [agent1UserId, setAgent1UserId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ asOf })
      if (groupId) qs.set('groupId', groupId)
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      setRows(
        await api<Row[]>(withBranchQuery(`/api/reports/group-collection-sheet?${qs}`, filterBranchId)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [asOf, groupId, agent1UserId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const sections = useMemo(() => {
    const byGroup = new Map<string, Map<number, CustomerBlock>>()
    for (const r of rows) {
      const groupKey = r.groupName || '(No group)'
      if (!byGroup.has(groupKey)) byGroup.set(groupKey, new Map())
      const customers = byGroup.get(groupKey)!
      let block = customers.get(r.customerId)
      if (!block) {
        block = {
          customerId: r.customerId,
          customerName: r.customerName,
          customerMobile: r.customerMobile,
          agent1Name: r.agent1Name,
          rows: [],
          dayTotal: 0,
          loanBalance: 0,
          primarySavings: 0,
          extraSavings: 0,
          seenLoans: new Set<number>(),
        }
        customers.set(r.customerId, block)
      }
      block.rows.push(r)
      block.dayTotal += r.remaining
      if (!block.seenLoans.has(r.loanId)) {
        block.seenLoans.add(r.loanId)
        block.loanBalance += r.loanBalance
        block.primarySavings += r.primarySavingsBalance
        block.extraSavings += r.extraSavingsBalance
      }
    }

    return [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, customers]) => {
        const customerList = [...customers.values()].sort((a, b) => a.customerName.localeCompare(b.customerName))
        const dayTotal = customerList.reduce((s, c) => s + c.dayTotal, 0)
        const primaryTotal = customerList.reduce((s, c) => s + c.primarySavings, 0)
        const extraTotal = customerList.reduce((s, c) => s + c.extraSavings, 0)
        const balanceTotal = customerList.reduce((s, c) => s + c.loanBalance, 0)
        return { groupName, customers: customerList, dayTotal, primaryTotal, extraTotal, balanceTotal }
      })
  }, [rows])

  const totals = useMemo(() => {
    let dayTotal = 0
    let balance = 0
    let primary = 0
    let extra = 0
    const customers = new Set<number>()
    for (const r of rows) {
      dayTotal += r.remaining
      customers.add(r.customerId)
    }
    for (const section of sections) {
      balance += section.balanceTotal
      primary += section.primaryTotal
      extra += section.extraTotal
    }
    return { dayTotal, balance, primary, extra, customers: customers.size, groups: sections.length }
  }, [rows, sections])

  return (
    <ReportChrome
      title="Group printable collection sheet"
      description="Per group / customer: payment schedule for the day, day total, loan balance, primary and extra savings."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `group-sheet-${asOf}.csv`,
          [
            'Group',
            'Customer',
            'Mobile',
            'Agent',
            'Loan',
            'Inst #',
            'Due date',
            'Amount due',
            'Paid',
            'Day remaining',
            'Loan balance',
            'Primary savings',
            'Extra savings',
            'Overdue',
          ],
          rows.map((r) => [
            r.groupName,
            r.customerName,
            r.customerMobile,
            r.agent1Name,
            r.loanNumber,
            r.installmentNumber,
            r.dueDate.slice(0, 10),
            r.amountDue,
            r.paidAmount,
            r.remaining,
            r.loanBalance,
            r.primarySavingsBalance,
            r.extraSavingsBalance,
            r.isOverdue ? 'Yes' : 'No',
          ]),
        )
      }
      filters={
        <div className="flex flex-wrap gap-3">
          <FilterField label="As of">
            <input className={filterClass} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
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
          <ReportStat label="Groups" value={String(totals.groups)} hint={`${totals.customers} customer(s)`} />
          <ReportStat label="Day total" value={money(totals.dayTotal)} />
          <ReportStat label="Loan balances" value={money(totals.balance)} />
          <ReportStat
            label="Savings"
            value={money(totals.primary + totals.extra)}
            hint={`Primary ${money(totals.primary)} · Extra ${money(totals.extra)}`}
          />
        </ReportSummary>
      }
    >
      <div className="space-y-8 p-4 print:p-0">
        <div className="hidden print:block print:mb-3">
          <h1 className="text-lg font-semibold">Group collection sheet — {asOf}</h1>
          <p className="text-xs text-slate-600">
            Day total {money(totals.dayTotal)} · {totals.customers} customer(s) · {totals.groups} group(s)
          </p>
        </div>

        {sections.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No dues for these filters.</p>
        ) : (
          sections.map((section) => (
            <section key={section.groupName} className="break-inside-avoid border-b border-slate-200 pb-6 last:border-0">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-slate-300 pb-2">
                <h2 className="text-base font-semibold text-slate-900">{section.groupName}</h2>
                <div className="text-xs text-slate-600 sm:text-right">
                  <div>
                    Day total <strong>{money(section.dayTotal)}</strong>
                  </div>
                  <div>
                    Balances {money(section.balanceTotal)} · Primary {money(section.primaryTotal)} · Extra{' '}
                    {money(section.extraTotal)}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {section.customers.map((c) => (
                  <div key={c.customerId} className="break-inside-avoid rounded-lg border border-slate-200 p-3 print:rounded-none print:border-slate-300">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900">{c.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {[c.customerMobile, c.agent1Name ? `Agent: ${c.agent1Name}` : null]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-right">
                        <span className="text-slate-500">Day total</span>
                        <span className="font-semibold">{money(c.dayTotal)}</span>
                        <span className="text-slate-500">Loan balance</span>
                        <span className="font-medium">{money(c.loanBalance)}</span>
                        <span className="text-slate-500">Primary savings</span>
                        <span>{money(c.primarySavings)}</span>
                        <span className="text-slate-500">Extra savings</span>
                        <span>{money(c.extraSavings)}</span>
                      </div>
                    </div>

                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-1 pr-2 font-medium">Loan</th>
                          <th className="py-1 pr-2 font-medium">Sched #</th>
                          <th className="py-1 pr-2 font-medium">Due date</th>
                          <th className="py-1 pr-2 font-medium text-right">Amount due</th>
                          <th className="py-1 pr-2 font-medium text-right">Paid</th>
                          <th className="py-1 font-medium text-right">Balance due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {c.rows.map((r) => (
                          <tr key={r.scheduleItemId}>
                            <td className="py-1.5 pr-2">{r.loanNumber}</td>
                            <td className="py-1.5 pr-2">#{r.installmentNumber}</td>
                            <td className="py-1.5 pr-2">
                              {r.dueDate.slice(0, 10)}
                              {r.isOverdue ? <span className="ml-1 text-rose-600">overdue</span> : null}
                            </td>
                            <td className="py-1.5 pr-2 text-right">{money(r.amountDue + r.penaltyAmount)}</td>
                            <td className="py-1.5 pr-2 text-right">{money(r.paidAmount)}</td>
                            <td className="py-1.5 text-right font-medium">{money(r.remaining)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </ReportChrome>
  )
}
