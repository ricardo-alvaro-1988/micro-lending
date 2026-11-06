import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { downloadCsv, todayIso } from '../../reports/csv'
import { FilterField, ReportChrome, ReportStat, ReportSummary, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type Row = {
  noteId: number
  loanNumber: string
  customerName: string
  agent1Name?: string | null
  body: string
  createdBy: string
  createdAt: string
  attachmentCount: number
}

export function FieldNotesLogReportPage() {
  const { filterBranchId, agents, groups } = useReportFilters()
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(todayIso())
  const [agent1UserId, setAgent1UserId] = useState('')
  const [createdByUserId, setCreatedByUserId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to })
      if (agent1UserId) qs.set('agent1UserId', agent1UserId)
      if (createdByUserId) qs.set('createdByUserId', createdByUserId)
      if (groupId) qs.set('groupId', groupId)
      setRows(await api<Row[]>(withBranchQuery(`/api/reports/field-notes-log?${qs}`, filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to, agent1UserId, createdByUserId, groupId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const loans = new Set(rows.map((r) => r.loanNumber).filter(Boolean))
    return { loans: loans.size }
  }, [rows])

  return (
    <ReportChrome
      title="Field visit / notes log"
      description="Field notes and attachment counts by author and date."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() =>
        downloadCsv(
          `field-notes-${from}_${to}.csv`,
          ['Created', 'Author', 'Customer', 'Agent1', 'Loan', 'Body', 'Attachments'],
          rows.map((r) => [
            r.createdAt,
            r.createdBy,
            r.customerName,
            r.agent1Name,
            r.loanNumber,
            r.body,
            r.attachmentCount,
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
          <FilterField label="Customer Agent 1">
            <select className={filterClass} value={agent1UserId} onChange={(e) => setAgent1UserId(e.target.value)}>
              <option value="">All</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Note author">
            <select
              className={filterClass}
              value={createdByUserId}
              onChange={(e) => setCreatedByUserId(e.target.value)}
            >
              <option value="">All authors</option>
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
          <ReportStat label="Notes" value={String(rows.length)} />
          <ReportStat label="Loans touched" value={String(totals.loans)} />
        </ReportSummary>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Author</th>
              <th className="px-3 py-2">Customer / loan</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2 text-right">Files</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No field notes in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.noteId}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.createdBy}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-500">
                      {r.loanNumber}
                      {r.agent1Name ? ` · ${r.agent1Name}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 max-w-md whitespace-pre-wrap text-slate-700">{r.body}</td>
                  <td className="px-3 py-2 text-right">{r.attachmentCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChrome>
  )
}
