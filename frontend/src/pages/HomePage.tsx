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
    </section>
  )
}
