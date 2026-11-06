import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { ActiveTag } from '../components/StatusTag'
import type { Branch } from '../types'

const emptyForm = () => ({
  name: '',
  code: '',
  address: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  phone: '',
  email: '',
  isActive: true,
})

export function BranchesPage() {
  const { can } = useAuth()
  const canManage = can('branches.manage')
  const [branches, setBranches] = useState<Branch[]>([])
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
      setBranches(await api<Branch[]>('/api/branches'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches')
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

  const selectBranch = (branch: Branch) => {
    setSelectedId(branch.id)
    setForm({
      name: branch.name,
      code: branch.code ?? '',
      address: branch.address ?? '',
      barangay: branch.barangay ?? '',
      city: branch.city ?? '',
      province: branch.province ?? '',
      zipCode: branch.zipCode ?? '',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      isActive: branch.isActive,
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
        code: form.code.trim() || null,
        address: form.address.trim() || null,
        barangay: form.barangay.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        zipCode: form.zipCode.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        isActive: form.isActive,
      }
      if (selectedId == null) {
        const created = await api<Branch>('/api/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Branch created.')
        await load()
        selectBranch(created)
      } else {
        const updated = await api<Branch>(`/api/branches/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setMessage('Branch updated.')
        await load()
        selectBranch(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this branch?')) return
    setDeletingId(id)
    setError('')
    try {
      await api(`/api/branches/${id}`, { method: 'DELETE' })
      if (selectedId === id) resetNew()
      setMessage('Branch deleted.')
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
          <h2 className="text-xl font-semibold">Branches</h2>
          <p className="text-sm text-slate-500">
            Manage office branches. Link users and customers to a branch.
          </p>
        </div>
        {canManage && (
          <ActionButton type="button" onClick={resetNew}>
            New branch
          </ActionButton>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRow colSpan={2} label="Loading branches..." />
              ) : branches.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={2}>
                    No branches yet.
                  </td>
                </tr>
              ) : (
                branches.map((branch) => (
                  <tr
                    key={branch.id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                      selectedId === branch.id ? 'bg-sky-50' : ''
                    }`}
                    onClick={() => selectBranch(branch)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {branch.name}
                        {branch.code ? (
                          <span className="ml-1.5 text-xs font-normal text-slate-500">({branch.code})</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {branch.city || branch.addressDisplay || 'No address'} · {branch.customerCount} cust ·{' '}
                        {branch.userCount} user{branch.userCount === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ActiveTag active={branch.isActive} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={onSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Name *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                disabled={!canManage}
                placeholder="e.g. Head Office"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Code</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                disabled={!canManage}
                placeholder="e.g. HO"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Address</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              disabled={!canManage}
              placeholder="Street / building"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Barangay</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.barangay}
                onChange={(e) => setForm((prev) => ({ ...prev, barangay: e.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">City</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Province</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.province}
                onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Zip code</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.zipCode}
                onChange={(e) => setForm((prev) => ({ ...prev, zipCode: e.target.value }))}
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Phone</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
              <input
                type="email"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={!canManage}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              disabled={!canManage}
            />
            Active (available in User and Customer dropdowns)
          </label>

          {canManage && (
            <div className="flex flex-wrap gap-3">
              <ActionButton type="submit" loading={saving} loadingText="Saving…">
                {selectedId == null ? 'Create branch' : 'Save branch'}
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
