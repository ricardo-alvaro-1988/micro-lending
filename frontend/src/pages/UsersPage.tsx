import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { PasswordInput } from '../components/PasswordInput'
import { StatusTag } from '../components/StatusTag'
import type { AppUser, Branch, Role } from '../types'

export function UsersPage() {
  const { can, user: me } = useAuth()
  const { filterBranchId, isAdmin, userBranchId } = useBranchScope()
  const canManage = can('users.manage')
  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    password: '',
    roleName: 'Admin',
    branchId: '' as number | '',
  })
  const [editForm, setEditForm] = useState({ fullName: '', roleName: '', branchId: '' as number | '' })
  const [resetPassword, setResetPassword] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [u, r, b] = await Promise.all([
        api<AppUser[]>(withBranchQuery('/api/users', filterBranchId)),
        api<Role[]>('/api/roles'),
        api<Branch[]>(withBranchQuery('/api/branches?activeOnly=true', filterBranchId)),
      ])
      setUsers(u)
      setRoles(r)
      setBranches(b)
      if (r.length && !r.some((x) => x.name === form.roleName)) {
        setForm((f) => ({ ...f, roleName: r[0].name }))
      }
      if (!isAdmin && userBranchId != null) {
        setForm((f) => ({ ...f, branchId: f.branchId === '' ? userBranchId : f.branchId }))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setCreating(true)
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          branchId: form.branchId === '' ? null : Number(form.branchId),
        }),
      })
      setForm({
        email: '',
        fullName: '',
        password: '',
        roleName: roles[0]?.name ?? 'Admin',
        branchId: '',
      })
      setMessage('User created.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (u: AppUser) => {
    setEditingId(u.id)
    setResetId(null)
    setEditForm({
      fullName: u.fullName,
      roleName: u.role,
      branchId: u.branchId ?? '',
    })
    setError('')
    setMessage('')
  }

  const onSaveEdit = async (id: string) => {
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      await api(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editForm.fullName,
          roleName: editForm.roleName,
          branchId: editForm.branchId === '' ? null : Number(editForm.branchId),
        }),
      })
      setEditingId(null)
      setMessage('User updated.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const onResetPassword = async (id: string) => {
    if (!resetPassword.trim()) {
      setError('Enter a new password.')
      return
    }
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      await api(`/api/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPassword }),
      })
      setResetId(null)
      setResetPassword('')
      setMessage('Password reset.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusyId(null)
    }
  }

  const onSetActive = async (u: AppUser, isActive: boolean) => {
    const action = isActive ? 'activate' : 'deactivate'
    if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} ${u.fullName}?`)) return
    setBusyId(u.id)
    setError('')
    setMessage('')
    try {
      await api(`/api/users/${u.id}/set-active`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
      })
      setMessage(`User ${action}d.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setBusyId(null)
    }
  }

  const onSoftDelete = async (u: AppUser) => {
    if (!confirm(`Soft-delete ${u.fullName}? They will no longer be able to sign in.`)) return
    setBusyId(u.id)
    setError('')
    setMessage('')
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' })
      setMessage('User soft-deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const onRestore = async (u: AppUser) => {
    if (!confirm(`Restore ${u.fullName}?`)) return
    setBusyId(u.id)
    setError('')
    setMessage('')
    try {
      await api(`/api/users/${u.id}/restore`, { method: 'POST' })
      setMessage('User restored.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setBusyId(null)
    }
  }

  const statusFor = (u: AppUser) => {
    if (u.isDeleted) return 'Deleted'
    return u.isActive ? 'Active' : 'Inactive'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-slate-500">
          Admin can create users, reset passwords, deactivate accounts, and soft-delete accounts.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      )}

      {canManage && (
        <form
          onSubmit={onCreate}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <PasswordInput
            className="text-sm"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.roleName}
            onChange={(e) => setForm({ ...form, roleName: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.branchId === '' ? '' : String(form.branchId)}
            onChange={(e) =>
              setForm({ ...form, branchId: e.target.value ? Number(e.target.value) : '' })
            }
            disabled={!isAdmin}
          >
            {isAdmin && <option value="">No branch</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.code ? ` (${b.code})` : ''}
              </option>
            ))}
          </select>
          <ActionButton type="submit" loading={creating} loadingText="Creating…">
            Create user
          </ActionButton>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <LoadingTableRow colSpan={6} label="Loading users..." />
            ) : (
              <>
            {users.map((u) => {
              const isSelf = me?.id === u.id
              const busy = busyId === u.id
              return (
                <tr key={u.id} className={`border-t border-slate-100 ${u.isDeleted ? 'bg-slate-50/80' : ''}`}>
                  <td className="px-4 py-3 align-top font-medium">
                    {editingId === u.id ? (
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      />
                    ) : (
                      u.fullName
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">{u.email}</td>
                  <td className="px-4 py-3 align-top">
                    {editingId === u.id ? (
                      <select
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        value={editForm.roleName}
                        onChange={(e) => setEditForm({ ...editForm, roleName: e.target.value })}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      u.role
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {editingId === u.id ? (
                      <select
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        value={editForm.branchId === '' ? '' : String(editForm.branchId)}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            branchId: e.target.value ? Number(e.target.value) : '',
                          })
                        }
                      >
                        <option value="">No branch</option>
                        {editForm.branchId !== '' &&
                          !branches.some((b) => b.id === editForm.branchId) && (
                            <option value={editForm.branchId}>
                              {u.branchName || `Branch #${editForm.branchId}`} (inactive)
                            </option>
                          )}
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                            {b.code ? ` (${b.code})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      u.branchName || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusTag status={statusFor(u)} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    {!canManage ? (
                      <span className="text-slate-400">—</span>
                    ) : u.isDeleted ? (
                      <ActionButton type="button" loading={busy} loadingText="Restoring…" onClick={() => void onRestore(u)}>
                        Restore
                      </ActionButton>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {editingId === u.id ? (
                          <div className="flex flex-wrap gap-3">
                            <ActionButton
                              type="button"
                              loading={busy}
                              loadingText="Saving…"
                              onClick={() => void onSaveEdit(u.id)}
                            >
                              Save
                            </ActionButton>
                            <ActionButton type="button" variant="danger" onClick={() => setEditingId(null)}>
                              Cancel
                            </ActionButton>
                          </div>
                        ) : resetId === u.id ? (
                          <div className="flex max-w-xs flex-col gap-2">
                            <PasswordInput
                              className="text-sm"
                              placeholder="New password"
                              value={resetPassword}
                              onChange={(e) => setResetPassword(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-3">
                              <ActionButton
                                type="button"
                                loading={busy}
                                loadingText="Resetting…"
                                onClick={() => void onResetPassword(u.id)}
                              >
                                Save password
                              </ActionButton>
                              <ActionButton
                                type="button"
                                variant="danger"
                                onClick={() => {
                                  setResetId(null)
                                  setResetPassword('')
                                }}
                              >
                                Cancel
                              </ActionButton>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <button type="button" className="text-sky-700 hover:underline" onClick={() => startEdit(u)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-sky-700 hover:underline"
                              onClick={() => {
                                setResetId(u.id)
                                setEditingId(null)
                                setResetPassword('')
                                setError('')
                              }}
                            >
                              Reset password
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                className="text-sky-700 hover:underline"
                                onClick={() => void onSetActive(u, !u.isActive)}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                type="button"
                                className="text-red-600 hover:underline"
                                onClick={() => void onSoftDelete(u)}
                              >
                                Soft delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {!loading && users.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  No users found.
                </td>
              </tr>
            )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
