import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/authContext'

interface NavItem {
  to: string
  label: string
}

/** Add a link here when you build a page. */
const NAV_ITEMS: NavItem[] = [{ to: '/', label: 'Home' }]

export function AppLayout() {
  const { user, signOut } = useAuth()
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
          {NAV_ITEMS.map((item) => (
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
