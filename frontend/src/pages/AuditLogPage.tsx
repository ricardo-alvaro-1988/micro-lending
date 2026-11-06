import { Fragment, useEffect, useState } from 'react'
import { api } from '../api/client'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { StatusTag } from '../components/StatusTag'
import type { AuditLogEntry } from '../types'

const fieldClass = 'rounded-md border border-slate-300 px-3 py-2 text-sm'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogEntry[]>([])
  const [entityType, setEntityType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (entityType.trim()) params.set('entityType', entityType.trim())
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      setRows(await api<AuditLogEntry[]>(`/api/audit-logs${qs ? `?${qs}` : ''}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Audit log</h2>
        <p className="mt-1 text-sm text-slate-500">
          Who changed roles, users, permissions, late fees, and cash remittances.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm text-slate-600">
          Entity type
          <input
            className={`${fieldClass} mt-1 block min-w-[10rem]`}
            placeholder="e.g. Role, User"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-600">
          From
          <input
            type="date"
            className={`${fieldClass} mt-1 block`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-600">
          To
          <input
            type="date"
            className={`${fieldClass} mt-1 block`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <ActionButton type="button" onClick={() => void load()}>
          Filter
        </ActionButton>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingTableRow colSpan={5} label="Loading audit log…" />
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No audit entries match the filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatWhen(row.occurredAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.actorUserName}</td>
                    <td className="px-4 py-3">
                      <StatusTag status={row.action} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.entityType}
                      {row.entityId ? (
                        <span className="ml-1 text-xs text-slate-400">#{row.entityId}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.summary}</td>
                  </tr>
                  {expandedId === row.id && row.detailsJson ? (
                    <tr className="border-t border-slate-50 bg-slate-50/80">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="max-h-48 overflow-auto rounded-md bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(row.detailsJson), null, 2)
                            } catch {
                              return row.detailsJson
                            }
                          })()}
                        </pre>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
