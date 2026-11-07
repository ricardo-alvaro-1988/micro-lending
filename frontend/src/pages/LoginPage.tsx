import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homePathFor } from '../auth/homePath'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { PasswordInput } from '../components/PasswordInput'

export function LoginPage() {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@micro.local')
  const [password, setPassword] = useState('Admin123!')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to={homePathFor(user)} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const loggedIn = await login(email, password)
      navigate(homePathFor(loggedIn))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f3f5f8_55%)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Micro Lending</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Office console — works on your local network.</p>
          <p className="mt-1 text-xs text-slate-400">Version 0.1.0</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-slate-600">Email</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <div className="mb-6">
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <ActionButton type="submit" loading={submitting} loadingText="Signing in…" className="w-full py-2.5">
          Login
        </ActionButton>
      </form>
    </div>
  )
}
