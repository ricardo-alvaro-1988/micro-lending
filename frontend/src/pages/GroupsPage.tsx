import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { ActiveTag } from '../components/StatusTag'
import type { CustomerGroup } from '../types'

const emptyForm = () => ({
  name: '',
  description: '',
  isActive: true,
})

export function GroupsPage() {
  const { can } = useAuth()
  const canManage = can('groups.manage')
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setGroups(await api<CustomerGroup[]>('/api/groups'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetNew = () => {
    setSelectedId(null)
    setForm(emptyForm())
    setMessage('')
    setError('')
  }

  const selectGroup = (group: CustomerGroup) => {
    setSelectedId(group.id)
    setForm({
      name: group.name,
      description: group.description ?? '',
      isActive: group.isActive,
    })
    setMessage('')
    setError('')
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        isActive: form.isActive,
      }
      if (selectedId == null) {
        const created = await api<CustomerGroup>('/api/groups', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Group created.')
        await load()
        selectGroup(created)
      } else {
        const updated = await api<CustomerGroup>(`/api/groups/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setMessage('Group updated.')
        await load()
        selectGroup(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this group?')) return
    setDeletingId(id)
    setError('')
    try {
      await api(`/api/groups/${id}`, { method: 'DELETE' })
      if (selectedId === id) resetNew()
      setMessage('Group deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Groups</h2>
          <p className="text-sm text-slate-500">Manage customer groups used on the Customers form.</p>
        </div>
        {canManage && (
          <ActionButton type="button" onClick={resetNew}>
            New group
          </ActionButton>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRow colSpan={2} label="Loading groups..." />
              ) : groups.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={2}>
                    No groups yet.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr
                    key={group.id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                      selectedId === group.id ? 'bg-sky-50' : ''
                    }`}
                    onClick={() => selectGroup(group)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-slate-500">{group.customerCount} customer{group.customerCount === 1 ? '' : 's'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ActiveTag active={group.isActive} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={onSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Name *</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              disabled={!canManage}
              placeholder="e.g. Individual, SME"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Description</label>
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              disabled={!canManage}
              placeholder="Optional notes"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              disabled={!canManage}
            />
            Active (available in Customer dropdown)
          </label>

          {canManage && (
            <div className="flex flex-wrap gap-3">
              <ActionButton type="submit" loading={saving} loadingText="Saving…">
                {selectedId == null ? 'Create group' : 'Save group'}
              </ActionButton>
              {selectedId != null && (
                <ActionButton
                  type="button"
                  variant="danger"
                  loading={deletingId === selectedId}
                  loadingText="Deleting…"
                  onClick={() => void onDelete(selectedId)}
                >
                  Delete
                </ActionButton>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
