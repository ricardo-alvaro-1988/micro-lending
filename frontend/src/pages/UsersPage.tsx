import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, apiForm } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { PasswordInput } from '../components/PasswordInput'
import { StatusTag } from '../components/StatusTag'
import { UserAvatar } from '../components/UserAvatar'
import type { AppUser, Branch, Role } from '../types'
import { useToast } from '../toast/ToastContext'

const fieldClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm'

type UserForm = {
  email: string
  password: string
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  mobile: string
  phone: string
  houseUnit: string
  street: string
  barangay: string
  city: string
  province: string
  zipCode: string
  roleName: string
  branchId: number | ''
}

const emptyForm = (roleName = 'Admin'): UserForm => ({
  email: '',
  password: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  mobile: '',
  phone: '',
  houseUnit: '',
  street: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  roleName,
  branchId: '',
})

function toDateInput(value?: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

function profilePayload(form: UserForm) {
  return {
    firstName: form.firstName,
    middleName: form.middleName || null,
    lastName: form.lastName,
    dateOfBirth: form.dateOfBirth || null,
    mobile: form.mobile || null,
    phone: form.phone || null,
    houseUnit: form.houseUnit || null,
    street: form.street || null,
    barangay: form.barangay || null,
    city: form.city || null,
    province: form.province || null,
    zipCode: form.zipCode || null,
    roleName: form.roleName,
    branchId: form.branchId === '' ? null : Number(form.branchId),
  }
}

export function UsersPage() {
  const { can, user: me } = useAuth()
  const { filterBranchId, isAdmin, userBranchId } = useBranchScope()
  const canManage = can('users.manage')
  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm())
  const [editForm, setEditForm] = useState<UserForm>(emptyForm())
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [editPhoto, setEditPhoto] = useState<File | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  const pendingPreview = useMemo(() => (pendingPhoto ? URL.createObjectURL(pendingPhoto) : null), [pendingPhoto])
  const editPreview = useMemo(() => (editPhoto ? URL.createObjectURL(editPhoto) : null), [editPhoto])
  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
  }, [pendingPreview])
  useEffect(() => () => {
    if (editPreview) URL.revokeObjectURL(editPreview)
  }, [editPreview])

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
      const defaultRole = r[0]?.name ?? 'Admin'
      setForm((f) => ({
        ...f,
        roleName: r.some((x) => x.name === f.roleName) ? f.roleName : defaultRole,
        branchId: !isAdmin && userBranchId != null && f.branchId === '' ? userBranchId : f.branchId,
      }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const created = await api<AppUser>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          ...profilePayload(form),
        }),
      })
      if (pendingPhoto) {
        const fd = new FormData()
        fd.append('file', pendingPhoto)
        await apiForm(`/api/users/${created.id}/profile-picture`, fd)
      }
      setForm(emptyForm(roles[0]?.name ?? 'Admin'))
      setPendingPhoto(null)
      toast.success('User created.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (u: AppUser) => {
    setEditingId(u.id)
    setResetId(null)
    setEditPhoto(null)
    setEditForm({
      ...emptyForm(u.role),
      email: u.email,
      firstName: u.firstName ?? '',
      middleName: u.middleName ?? '',
      lastName: u.lastName ?? '',
      dateOfBirth: toDateInput(u.dateOfBirth),
      mobile: u.mobile ?? '',
      phone: u.phone ?? '',
      houseUnit: u.houseUnit ?? '',
      street: u.street ?? '',
      barangay: u.barangay ?? '',
      city: u.city ?? '',
      province: u.province ?? '',
      zipCode: u.zipCode ?? '',
      roleName: u.role,
      branchId: u.branchId ?? '',
    })
  }

  const onSaveEdit = async (id: string) => {
    setBusyId(id)
    try {
      await api(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(profilePayload(editForm)),
      })
      if (editPhoto) {
        const fd = new FormData()
        fd.append('file', editPhoto)
        await apiForm(`/api/users/${id}/profile-picture`, fd)
      }
      setEditingId(null)
      setEditPhoto(null)
      toast.success('User updated.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const onResetPassword = async (id: string) => {
    if (!resetPassword.trim()) {
      toast.error('Enter a new password.')
      return
    }
    setBusyId(id)
    try {
      await api(`/api/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPassword }),
      })
      setResetId(null)
      setResetPassword('')
      toast.success('Password reset.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusyId(null)
    }
  }

  const onSetActive = async (u: AppUser, isActive: boolean) => {
    const action = isActive ? 'activate' : 'deactivate'
    if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} ${u.fullName}?`)) return
    setBusyId(u.id)
    try {
      await api(`/api/users/${u.id}/set-active`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
      })
      toast.success(`User ${action}d.`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setBusyId(null)
    }
  }

  const onSoftDelete = async (u: AppUser) => {
    if (!confirm(`Soft-delete ${u.fullName}? They will no longer be able to sign in.`)) return
    setBusyId(u.id)
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' })
      toast.success('User soft-deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const onRestore = async (u: AppUser) => {
    if (!confirm(`Restore ${u.fullName}?`)) return
    setBusyId(u.id)
    try {
      await api(`/api/users/${u.id}/restore`, { method: 'POST' })
      toast.success('User restored.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setBusyId(null)
    }
  }

  const statusFor = (u: AppUser) => {
    if (u.isDeleted) return 'Deleted'
    return u.isActive ? 'Active' : 'Inactive'
  }

  const ProfileFields = ({
    value,
    onChange,
    includeEmailPassword,
  }: {
    value: UserForm
    onChange: (next: UserForm) => void
    includeEmailPassword?: boolean
  }) => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {includeEmailPassword && (
        <>
          <input
            className={fieldClass}
            placeholder="Email *"
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            required
          />
          <PasswordInput
            className="text-sm"
            placeholder="Password *"
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            required
          />
        </>
      )}
      <input className={fieldClass} placeholder="First name *" value={value.firstName} onChange={(e) => onChange({ ...value, firstName: e.target.value })} required />
      <input className={fieldClass} placeholder="Middle name" value={value.middleName} onChange={(e) => onChange({ ...value, middleName: e.target.value })} />
      <input className={fieldClass} placeholder="Last name *" value={value.lastName} onChange={(e) => onChange({ ...value, lastName: e.target.value })} required />
      <input className={fieldClass} type="date" value={value.dateOfBirth} onChange={(e) => onChange({ ...value, dateOfBirth: e.target.value })} title="Birthday" />
      <input className={fieldClass} placeholder="Mobile" value={value.mobile} onChange={(e) => onChange({ ...value, mobile: e.target.value })} />
      <input className={fieldClass} placeholder="Phone" value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
      <input className={fieldClass} placeholder="House / Unit" value={value.houseUnit} onChange={(e) => onChange({ ...value, houseUnit: e.target.value })} />
      <input className={fieldClass} placeholder="Street" value={value.street} onChange={(e) => onChange({ ...value, street: e.target.value })} />
      <input className={fieldClass} placeholder="Barangay" value={value.barangay} onChange={(e) => onChange({ ...value, barangay: e.target.value })} />
      <input className={fieldClass} placeholder="City" value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} />
      <input className={fieldClass} placeholder="Province" value={value.province} onChange={(e) => onChange({ ...value, province: e.target.value })} />
      <input className={fieldClass} placeholder="Zip code" value={value.zipCode} onChange={(e) => onChange({ ...value, zipCode: e.target.value })} />
      <select className={fieldClass} value={value.roleName} onChange={(e) => onChange({ ...value, roleName: e.target.value })}>
        {roles.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        className={fieldClass}
        value={value.branchId === '' ? '' : String(value.branchId)}
        onChange={(e) => onChange({ ...value, branchId: e.target.value ? Number(e.target.value) : '' })}
        disabled={!isAdmin && includeEmailPassword}
      >
        {isAdmin && <option value="">No branch</option>}
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.code ? ` (${b.code})` : ''}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-slate-500">
          Complete user profiles: name, birthday, contact, address, and optional photo.
        </p>
      </div>

      {canManage && (
        <form onSubmit={onCreate} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Create user</h3>
          <div className="flex flex-wrap items-center gap-3">
            {pendingPreview ? (
              <img src={pendingPreview} alt="Preview" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">Photo</div>
            )}
            <input
              type="file"
              accept="image/*"
              className="text-sm"
              onChange={(e) => {
                setPendingPhoto(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>
          <ProfileFields value={form} onChange={setForm} includeEmailPassword />
          <ActionButton type="submit" loading={creating} loadingText="Creating…">
            Create user
          </ActionButton>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Role / Branch</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <LoadingTableRow colSpan={5} label="Loading users..." />
            ) : (
              <>
                {users.map((u) => {
                  const isSelf = me?.id === u.id
                  const busy = busyId === u.id
                  return (
                    <tr key={u.id} className={`border-t border-slate-100 ${u.isDeleted ? 'bg-slate-50/80' : ''}`}>
                      <td className="px-4 py-3 align-top">
                        {editingId === u.id ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar userId={u.id} hasPicture={u.hasProfilePicture && !editPhoto} name={u.fullName} className="h-12 w-12 rounded-xl text-sm" />
                              {editPreview && <img src={editPreview} alt="Preview" className="h-12 w-12 rounded-xl object-cover" />}
                              <input
                                type="file"
                                accept="image/*"
                                className="text-xs"
                                onChange={(e) => {
                                  setEditPhoto(e.target.files?.[0] ?? null)
                                  e.target.value = ''
                                }}
                              />
                            </div>
                            <ProfileFields value={editForm} onChange={setEditForm} />
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <UserAvatar userId={u.id} hasPicture={u.hasProfilePicture} name={u.fullName} className="h-10 w-10 rounded-xl text-xs" />
                            <div>
                              <div className="font-medium text-slate-900">{u.fullName}</div>
                              <div className="text-xs text-slate-500">{u.email}</div>
                              {u.dateOfBirth && (
                                <div className="text-xs text-slate-500">Born {new Date(u.dateOfBirth).toLocaleDateString()}</div>
                              )}
                              {u.addressDisplay && <div className="mt-1 max-w-xs text-xs text-slate-500">{u.addressDisplay}</div>}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {editingId === u.id ? '—' : (
                          <>
                            <div>{u.mobile || 'No mobile'}</div>
                            <div className="text-xs text-slate-400">{u.phone || 'No phone'}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {editingId === u.id ? '—' : (
                          <>
                            <div>{u.role}</div>
                            <div className="text-xs text-slate-500">{u.branchName || 'No branch'}</div>
                          </>
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
                                <ActionButton type="button" loading={busy} loadingText="Saving…" onClick={() => void onSaveEdit(u.id)}>
                                  Save
                                </ActionButton>
                                <ActionButton
                                  type="button"
                                  variant="danger"
                                  onClick={() => {
                                    setEditingId(null)
                                    setEditPhoto(null)
                                  }}
                                >
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
                                  <ActionButton type="button" loading={busy} loadingText="Resetting…" onClick={() => void onResetPassword(u.id)}>
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
                                  }}
                                >
                                  Reset password
                                </button>
                                {!isSelf && (
                                  <button type="button" className="text-sky-700 hover:underline" onClick={() => void onSetActive(u, !u.isActive)}>
                                    {u.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                )}
                                {!isSelf && (
                                  <button type="button" className="text-red-600 hover:underline" onClick={() => void onSoftDelete(u)}>
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
                    <td className="px-4 py-6 text-slate-500" colSpan={5}>
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
