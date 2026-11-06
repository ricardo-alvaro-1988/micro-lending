import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageLoading } from '../components/ListLoading'
import { useAuth } from './AuthContext'

export function RequireAuth({ permission }: { permission?: string }) {
  const { user, loading, can } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <PageLoading label="Loading..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (permission && !can(permission)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
