import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, apiForm } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { PasswordInput } from '../components/PasswordInput'
import { UserAvatar } from '../components/UserAvatar'
import type { AuthUser } from '../types'
import { useToast } from '../toast/ToastContext'

const fieldClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm'

function toDateInput(value?: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

type ProfileForm = {
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
}

function fromUser(user?: AuthUser | null): ProfileForm {
  return {
    firstName: user?.firstName ?? '',
    middleName: user?.middleName ?? '',
    lastName: user?.lastName ?? '',
    dateOfBirth: toDateInput(user?.dateOfBirth),
    mobile: user?.mobile ?? '',
    phone: user?.phone ?? '',
    houseUnit: user?.houseUnit ?? '',
    street: user?.street ?? '',
    barangay: user?.barangay ?? '',
    city: user?.city ?? '',
    province: user?.province ?? '',
    zipCode: user?.zipCode ?? '',
  }
}

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState<ProfileForm>(() => fromUser(user))
  const [hasPicture, setHasPicture] = useState(!!user?.hasProfilePicture)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const toast = useToast()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    api<AuthUser>('/api/profile')
      .then((detail) => {
        setUser(detail)
        setForm(fromUser(detail))
        setHasPicture(!!detail.hasProfilePicture)
      })
      .catch(() => {
        /* keep auth cache */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendingPreview = useMemo(() => (pendingPhoto ? URL.createObjectURL(pendingPhoto) : null), [pendingPhoto])
  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
  }, [pendingPreview])

  const setField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const updated = await api<AuthUser>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
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
        }),
      })
      if (pendingPhoto) {
        const fd = new FormData()
        fd.append('file', pendingPhoto)
        await apiForm('/api/profile/profile-picture', fd)
        updated.hasProfilePicture = true
        setPendingPhoto(null)
        setHasPicture(true)
      }
      setUser(updated)
      setForm(fromUser(updated))
      toast.success('Profile updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setSavingPassword(true)
    try {
      await api('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      })
      setNewPassword('')
      toast.success('Password changed.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="text-sm text-slate-500">Complete your personal details, contact, address, and photo.</p>
      </div>

      <form onSubmit={saveProfile} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <UserAvatar
            self
            hasPicture={hasPicture && !pendingPhoto}
            name={user?.fullName || `${form.firstName} ${form.lastName}`.trim() || 'User'}
            className="h-20 w-20 rounded-2xl text-lg"
          />
          {pendingPreview && (
            <img src={pendingPreview} alt="Selected" className="h-20 w-20 rounded-2xl object-cover" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-sm font-medium text-slate-700">Profile picture (optional)</div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
              onChange={(e) => {
                setPendingPhoto(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <div className="flex flex-wrap gap-2">
              {hasPicture && (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
                  disabled={photoBusy}
                  onClick={async () => {
                    if (!confirm('Remove profile picture?')) return
                    setPhotoBusy(true)
                    try {
                      await api('/api/profile/profile-picture', { method: 'DELETE' })
                      setHasPicture(false)
                      setPendingPhoto(null)
                      if (user) setUser({ ...user, hasProfilePicture: false })
                      toast.success('Profile picture removed.')
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Could not remove photo')
                    } finally {
                      setPhotoBusy(false)
                    }
                  }}
                >
                  Remove photo
                </button>
              )}
              {pendingPhoto && (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
                  onClick={() => setPendingPhoto(null)}
                >
                  Clear selection
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-sm text-slate-500">
            Email: <span className="font-medium text-slate-800">{user?.email}</span>
          </div>
          <div className="text-sm text-slate-500">
            Role: <span className="font-medium text-slate-800">{user?.role}</span>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Complete name</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <input className={fieldClass} placeholder="First name *" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} required />
            <input className={fieldClass} placeholder="Middle name" value={form.middleName} onChange={(e) => setField('middleName', e.target.value)} />
            <input className={fieldClass} placeholder="Last name *" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} required />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Birthday</span>
            <input className={fieldClass} type="date" value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Mobile</span>
            <input className={fieldClass} value={form.mobile} onChange={(e) => setField('mobile', e.target.value)} placeholder="Contact number" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Phone</span>
            <input className={fieldClass} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
          </label>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Address</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input className={fieldClass} placeholder="House / Unit" value={form.houseUnit} onChange={(e) => setField('houseUnit', e.target.value)} />
            <input className={fieldClass} placeholder="Street" value={form.street} onChange={(e) => setField('street', e.target.value)} />
            <input className={fieldClass} placeholder="Barangay" value={form.barangay} onChange={(e) => setField('barangay', e.target.value)} />
            <input className={fieldClass} placeholder="City" value={form.city} onChange={(e) => setField('city', e.target.value)} />
            <input className={fieldClass} placeholder="Province" value={form.province} onChange={(e) => setField('province', e.target.value)} />
            <input className={fieldClass} placeholder="Zip code" value={form.zipCode} onChange={(e) => setField('zipCode', e.target.value)} />
          </div>
        </div>

        <ActionButton type="submit" loading={savingProfile} loadingText="Saving…">
          Save profile
        </ActionButton>
      </form>

      <form onSubmit={changePassword} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-medium">Change password</h3>
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
        />
        <ActionButton type="submit" variant="dark" loading={savingPassword} loadingText="Updating…">
          Update password
        </ActionButton>
      </form>
    </div>
  )
}
