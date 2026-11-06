import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { PasswordInput } from '../components/PasswordInput'
import type { AuthUser } from '../types'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSavingProfile(true)
    try {
      const updated = await api<AuthUser>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName }),
      })
      setUser(updated)
      setMessage('Profile updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSavingPassword(true)
    try {
      await api('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      })
      setNewPassword('')
      setMessage('Password changed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="text-sm text-slate-500">Manage your account details.</p>
      </div>

      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={saveProfile} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-500">Email: <span className="font-medium text-slate-800">{user?.email}</span></div>
        <div className="text-sm text-slate-500">Role: <span className="font-medium text-slate-800">{user?.role}</span></div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Full name</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>
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
