import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import type { Role } from '../types'

export function RolesPage() {
  const { can } = useAuth()
  const canManage = can('roles.manage')
  const [roles, setRoles] = useState<Role[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setRoles(await api<Role[]>('/api/roles'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await api('/api/roles', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      })
      setName('')
      setDescription('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Delete this role?')) return
    setError('')
    setDeletingId(id)
    try {
      await api(`/api/roles/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Roles</h2>
        <p className="text-sm text-slate-500">Create roles, then set page access under Page Accessibility.</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {canManage && (
        <form onSubmit={onCreate} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <ActionButton type="submit" loading={creating} loadingText="Creating…">
            Create role
          </ActionButton>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Permissions</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingTableRow colSpan={4} label="Loading roles..." />
            ) : roles.map((role) => (
              <tr key={role.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">
                  {role.name}
                  {role.isSystem && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">System</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{role.description || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{role.permissions.length}</td>
                <td className="px-4 py-3">
                  {canManage && !role.isSystem && (
                    <ActionButton
                      type="button"
                      variant="danger"
                      loading={deletingId === role.id}
                      loadingText="Deleting…"
                      onClick={() => void onDelete(role.id)}
                    >
                      Delete
                    </ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
