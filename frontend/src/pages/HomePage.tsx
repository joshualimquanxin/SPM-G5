import { useAuth } from '../auth/authContext'

export function HomePage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <section>
      <h1>Welcome, {user.full_name}</h1>
      <p className="muted">
        You are signed in as <strong>{user.role_name}</strong>
        {user.organisation_name ? ` (${user.organisation_name})` : ''}.
      </p>
      <div className="card">
        <h2>Your permissions</h2>
        <p className="muted small">
          The navigation only shows pages your role can use. Feature pages appear here as their
          stories are completed.
        </p>
        <ul className="permission-list">
          {user.permissions.map((permission) => (
            <li key={permission}>
              <code>{permission}</code>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
