import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  customerId: number
  customerName: string
  mobile?: string | null
  branchName?: string | null
  groupName?: string | null
  agent1Name?: string | null
  agent2Name?: string | null
  agent3Name?: string | null
  loanCount: number
  activeLoanCount: number
  createdAt: string
}

export function CustomerAssignmentsReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [agent1UserId, setAgent1UserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (groupId) qs.set('groupId', groupId)
      const path = `/api/reports/customer-assignments${qs.toString() ? `?${qs}` : ''}`
      setRows(await api<Row[]>(withBranchQuery(path, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [agent1UserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const agentsAssigned = new Set<string>()
    let withAgent = 0
    for (const r of rows) {
      if (r.agent1Name) {
        agentsAssigned.add(r.agent1Name)
        withAgent += 1
      }
    }
    return { agentsAssigned: agentsAssigned.size, withAgent }
  }, [rows])

  return (
    <ReportChrome
      title="Customer master / agent assignment"
      description="Customers with branch, group, and Agent 1–3 assignments."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `customer-assignments.csv`,
          ['Customer', 'Mobile', 'Branch', 'Group', 'Agent1', 'Agent2', 'Agent3', 'Loans', 'Active', 'Created'],
          rows.map((r) => [
            r.customerName,
            r.mobile,
            r.branchName,
            r.groupName,
            r.agent1Name,
            r.agent2Name,
            r.agent3Name,
            r.loanCount,
            r.activeLoanCount,
            r.createdAt,
          ]),
        )
      }
      filters={
        <div className="flex flex-wrap gap-3">
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
          <ReportStat label="Customers" value={String(rows.length)} />
          <ReportStat
            label="Assigned agents"
            value={String(totals.agentsAssigned)}
            hint={`${totals.withAgent} with Agent 1`}
          />
        </ReportSummary>
      }
    >
      <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">{rows.length} customer(s)</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Agent 1</th>
              <th className="px-3 py-2">A2 / A3</th>
              <th className="px-3 py-2 text-right">Loans</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No customers for these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.customerId}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-500">
                      {r.mobile || '—'} · {r.branchName || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.groupName || '—'}</td>
                  <td className="px-3 py-2">{r.agent1Name || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {[r.agent2Name, r.agent3Name].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.activeLoanCount}/{r.loanCount}
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
