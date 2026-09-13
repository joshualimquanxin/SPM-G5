import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './authContext'

/** Route guard: send signed-out visitors to /login, remembering where they wanted to go. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="muted">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
