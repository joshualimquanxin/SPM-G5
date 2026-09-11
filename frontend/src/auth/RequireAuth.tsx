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

/**
 * Route guard for story 1.2 AC4: a direct URL to a page the role may not use shows a
 * "not permitted" message instead of the page. (The API refuses the calls anyway.)
 */
export function RequirePermission({ permission }: { permission: string }) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <section className="card">
        <h2>Not permitted</h2>
        <p>Your role does not have access to this page.</p>
      </section>
    )
  }
  return <Outlet />
}
