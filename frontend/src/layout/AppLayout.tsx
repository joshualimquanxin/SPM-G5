import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/authContext'

interface NavItem {
  to: string
  label: string
  /** Shown only when the user's role holds this permission (story 1.2 AC2). Omit = everyone. */
  permission?: string
}

/**
 * Add a link here when you build a page. The permission code must exist in
 * backend/app/auth/permissions.py - the backend is the source of truth for who may do what.
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/venues/manage', label: 'Manage venues', permission: 'venues:manage' },
]

export function AppLayout() {
  const { user, can, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="brand">
          ConnectSphere
        </NavLink>
        <nav aria-label="Main">
          {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="user-menu">
            <span className="user-name">
              {user.full_name} <span className="muted small">· {user.role_name}</span>
            </span>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
