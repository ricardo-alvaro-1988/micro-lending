import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import type { AppPage, RolePageAccess } from '../types'

export function PageAccessibilityPage() {
  const { can } = useAuth()
  const canManage = can('pages.manage')
  const [pages, setPages] = useState<AppPage[]>([])
  const [access, setAccess] = useState<RolePageAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [p, a] = await Promise.all([
        api<AppPage[]>('/api/pages'),
        api<RolePageAccess[]>('/api/pages/access'),
      ])
      setPages(p)
      setAccess(a)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [])

  const toggle = (roleId: string, pageCode: string) => {
    setAccess((prev) =>
      prev.map((row) => {
        if (row.roleId !== roleId) return row
        const has = row.pageCodes.includes(pageCode)
        return {
          ...row,
          pageCodes: has ? row.pageCodes.filter((c) => c !== pageCode) : [...row.pageCodes, pageCode],
        }
      }),
    )
  }

  const save = async (roleId: string) => {
    const row = access.find((r) => r.roleId === roleId)
    if (!row) return
    setSaving(roleId)
    setError('')
    try {
      const updated = await api<RolePageAccess>(`/api/pages/access/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ pageCodes: row.pageCodes }),
      })
      setAccess((prev) => prev.map((r) => (r.roleId === roleId ? updated : r)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Page Accessibility</h2>
        <p className="text-sm text-slate-500">Choose which pages each role can open.</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Role</th>
              {pages.map((p) => (
                <th key={p.code} className="px-4 py-3 font-medium whitespace-nowrap">{p.name}</th>
              ))}
              {canManage && <th className="px-4 py-3 font-medium">Save</th>}
            </tr>
          </thead>
          <tbody>
            {loading && access.length === 0 ? (
              <LoadingTableRow
                colSpan={Math.max(2, pages.length + (canManage ? 2 : 1))}
                label="Loading page access..."
              />
            ) : (
              access.map((row) => (
                <tr key={row.roleId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{row.roleName}</td>
                  {pages.map((p) => (
                    <td key={p.code} className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={!canManage || saving === row.roleId}
                        checked={row.pageCodes.includes(p.code)}
                        onChange={() => toggle(row.roleId, p.code)}
                      />
                    </td>
                  ))}
                  {canManage && (
                    <td className="px-4 py-3">
                      <ActionButton
                        type="button"
                        loading={saving === row.roleId}
                        loadingText="Saving…"
                        onClick={() => void save(row.roleId)}
                        className="px-3 py-1.5 text-xs"
                      >
                        Save
                      </ActionButton>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
