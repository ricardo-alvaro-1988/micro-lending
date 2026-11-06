import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, money, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  scheduleItemId: number
  customerName: string
  customerMobile?: string | null
  groupId?: number | null
  groupName?: string | null
  agent1Name?: string | null
  loanNumber: string
  installmentNumber: number
  dueDate: string
  amountDue: number
  paidAmount: number
  remaining: number
  isOverdue: boolean
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
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      const key = r.groupName || '(No group)'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  const totals = useMemo(() => {
    let expected = 0
    let collected = 0
    const customers = new Set<string>()
    for (const r of rows) {
      expected += r.amountDue
      collected += r.paidAmount
      customers.add(r.customerName)
    }
    return { expected, collected, customers: customers.size, groups: sections.length }
  }, [rows, sections.length])

  return (
    <ReportChrome
      title="Group / cluster collection sheet"
      description="Due installments for the day, organized by group for field printing."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `group-collection-${asOf}.csv`,
          ['Group', 'Customer', 'Mobile', 'Agent', 'Loan', 'Inst #', 'Due', 'Scheduled', 'Paid', 'Remaining', 'Overdue'],
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
          <ReportStat label="Expected" value={money(totals.expected)} />
          <ReportStat label="Collected" value={money(totals.collected)} tone="good" />
        </ReportSummary>
      }
    >
      <div className="space-y-6 p-3">
        {sections.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No dues for these filters.</p>
        ) : (
          sections.map(([groupName, items]) => {
            const total = items.reduce((s, r) => s + r.remaining, 0)
            return (
              <section key={groupName} className="break-inside-avoid">
                <div className="mb-2 flex items-end justify-between border-b border-slate-200 pb-1">
                  <h2 className="text-sm font-semibold text-slate-900">{groupName}</h2>
                  <div className="text-xs text-slate-500">
                    {items.length} item(s) · collect {money(total)}
                  </div>
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-2">Customer</th>
                      <th className="py-1 pr-2">Loan</th>
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2 text-right">Due</th>
                      <th className="py-1 text-right">Rem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((r) => (
                      <tr key={r.scheduleItemId}>
                        <td className="py-1.5 pr-2">
                          <div className="font-medium">{r.customerName}</div>
                          <div className="text-xs text-slate-500">{r.customerMobile || '—'}</div>
                        </td>
                        <td className="py-1.5 pr-2">{r.loanNumber}</td>
                        <td className="py-1.5 pr-2">{r.installmentNumber}</td>
                        <td className="py-1.5 pr-2 text-right">{money(r.amountDue)}</td>
                        <td className="py-1.5 text-right font-medium">{money(r.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })
        )}
      </div>
    </ReportChrome>
  )
}
