import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { formatApiError } from '../api/client'
import { getHealth } from '../api/health'
import { useAuth } from './authContext'
import { homeFor } from './homeFor'

const SAMPLE_ACCOUNTS: [string, string][] = [
  ['Event Organiser', 'organiser@acme.example'],
  ['Event Coordinator', 'coordinator@connectsphere.example'],
  ['Venue Staff', 'venue@connectsphere.example'],
  ['Technical Support Staff', 'tech@connectsphere.example'],
  ['Attendee', 'attendee@example.com'],
]

export function LoginPage() {
  const { user, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [backendStatus, setBackendStatus] = useState('checking...')

  useEffect(() => {
    getHealth()
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus('unreachable'))
  }, [])

  // Story 1.1 AC4: once signed in, go back to the deep link the visitor wanted (if any),
  // otherwise to the landing page for their role.
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : homeFor(user.role_code)} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <h1>ConnectSphere</h1>
      <p className="muted">Event planning &amp; venue booking</p>

      <form className="card login-form" onSubmit={handleSubmit} aria-label="Sign in">
        <h2>Sign in</h2>
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {import.meta.env.DEV && (
        <details className="muted sample-accounts">
          <summary>Sample accounts (development only)</summary>
          <p>
            Password for all: <code>Password123!</code>
          </p>
          <ul>
            {SAMPLE_ACCOUNTS.map(([role, sampleEmail]) => (
              <li key={sampleEmail}>
                <button type="button" className="link" onClick={() => setEmail(sampleEmail)}>
                  {sampleEmail}
                </button>{' '}
                – {role}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="muted small">
        Backend status: <strong>{backendStatus}</strong>
      </p>
    </main>
  )
}
