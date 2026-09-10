import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { formatApiError } from '../api/client'
import { listVenues, type VenueSummary } from '../api/venues'

/** Story 8.3 - Venue Staff entry point: list venues, jump to create / edit. */
export function VenueManagePage() {
  const [venues, setVenues] = useState<VenueSummary[] | null>(null)
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const flash = (useLocation().state as { flash?: string } | null)?.flash

  useEffect(() => {
    let cancelled = false
    listVenues(includeWithdrawn)
      .then((data) => {
        if (!cancelled) setVenues(data)
      })
      .catch((err) => {
        if (!cancelled) setError(formatApiError(err))
      })
    return () => {
      cancelled = true
    }
  }, [includeWithdrawn])

  return (
    <section>
      <div className="page-header">
        <h1>Manage venues</h1>
        <Link to="/venues/new" className="button">
          New venue
        </Link>
      </div>
      {flash && <p className="success">{flash}</p>}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={includeWithdrawn}
          onChange={(e) => setIncludeWithdrawn(e.target.checked)}
        />
        Show withdrawn venues
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {venues === null && !error && <p className="muted">Loading…</p>}
      {venues && venues.length === 0 && <p className="muted">No venues recorded yet.</p>}
      {venues && venues.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th className="num">Capacity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id}>
                  <td>{venue.name}</td>
                  <td>{venue.location}</td>
                  <td className="num">{venue.capacity}</td>
                  <td>
                    <span className={`badge badge-${venue.status.toLowerCase()}`}>
                      {venue.status === 'ACTIVE' ? 'Active' : 'Withdrawn'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/venues/${venue.id}/edit`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
