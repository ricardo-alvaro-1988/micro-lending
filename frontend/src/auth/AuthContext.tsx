import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import type { AuthUser } from '../types'

type AuthState = {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => void
  refreshMe: () => Promise<void>
  setUser: (user: AuthUser) => void
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ml_token'))
  const [loading, setLoading] = useState(() => !!localStorage.getItem('ml_token'))

  const applySession = useCallback((res: LoginResponse) => {
    localStorage.setItem('ml_token', res.token)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const refreshMe = useCallback(async () => {
    const res = await api<LoginResponse | AuthUser>('/api/auth/me')
    // Prefer new shape { token, user }; keep compat if API still returns user only.
    if (res && typeof res === 'object' && 'user' in res && 'token' in res) {
      applySession(res as LoginResponse)
      return
    }
    setUser(res as AuthUser)
  }, [applySession])

  useEffect(() => {
    if (!localStorage.getItem('ml_token')) {
      setLoading(false)
      return
    }
    refreshMe()
      .catch(() => {
        localStorage.removeItem('ml_token')
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
    // Mount once: refreshMe re-issues JWT with current permissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      applySession(res)
      return {
        ...res.user,
        isAdmin: res.user.isAdmin ?? res.user.role === 'Admin',
        branchId: res.user.branchId ?? null,
        branchName: res.user.branchName ?? null,
      }
    },
    [applySession],
  )

  const logout = useCallback(() => {
    localStorage.removeItem('ml_token')
    setToken(null)
    setUser(null)
  }, [])

  const can = useCallback(
    (permission: string) => !!user?.permissions?.includes(permission),
    [user],
  )

  // Normalize older sessions that may lack isAdmin / branch fields.
  const normalizedUser = useMemo(() => {
    if (!user) return null
    return {
      ...user,
      isAdmin: user.isAdmin ?? user.role === 'Admin',
      branchId: user.branchId ?? null,
      branchName: user.branchName ?? null,
    }
  }, [user])

  const value = useMemo(
    () => ({ user: normalizedUser, token, loading, login, logout, refreshMe, setUser, can }),
    [normalizedUser, token, loading, login, logout, refreshMe, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
