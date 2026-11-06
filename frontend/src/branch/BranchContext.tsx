import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'

const STORAGE_KEY = 'ml_admin_branch_filter'

type BranchContextValue = {
  isAdmin: boolean
  /** Null = all branches (admin). Staff always their own branch. */
  filterBranchId: number | null
  setFilterBranchId: (id: number | null) => void
  userBranchId: number | null
  userBranchName: string | null
  /** Query fragment for APIs, e.g. `&branchId=3` or empty. */
  branchQuery: string
  /** Object form for building query strings. */
  branchParams: { branchId?: number }
}

const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isAdmin = !!user?.isAdmin
  const userBranchId = user?.branchId ?? null
  const userBranchName = user?.branchName ?? null

  const [adminFilter, setAdminFilter] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  })

  useEffect(() => {
    if (adminFilter == null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(adminFilter))
  }, [adminFilter])

  const setFilterBranchId = useCallback(
    (id: number | null) => {
      if (!isAdmin) return
      setAdminFilter(id)
    },
    [isAdmin],
  )

  const filterBranchId = isAdmin ? adminFilter : userBranchId

  const value = useMemo<BranchContextValue>(
    () => ({
      isAdmin,
      filterBranchId,
      setFilterBranchId,
      userBranchId,
      userBranchName,
      branchQuery: filterBranchId != null ? `&branchId=${filterBranchId}` : '',
      branchParams: filterBranchId != null ? { branchId: filterBranchId } : {},
    }),
    [isAdmin, filterBranchId, setFilterBranchId, userBranchId, userBranchName],
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranchScope() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranchScope must be used within BranchProvider')
  return ctx
}

/** Append branchId to a path that may already have query params. */
export function withBranchQuery(path: string, branchId: number | null | undefined) {
  if (branchId == null) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}branchId=${branchId}`
}
