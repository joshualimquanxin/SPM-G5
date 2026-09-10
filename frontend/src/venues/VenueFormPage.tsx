import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { formatApiError } from '../api/client'
import {
  createVenue,
  fetchVenueReferenceData,
  getVenue,
  updateVenue,
  type Venue,
  type VenueInput,
  type VenueReferenceData,
  type VenueStatus,
} from '../api/venues'

/** Form state keeps strings so partially typed values never crash; converted on submit. */
interface FormState {
  name: string
  location: string
  capacity: string
  description: string
  floor_area_sqm: string
  operating_hours_start: string
  operating_hours_end: string
  operating_notes: string
  setup_minutes_default: string
  teardown_minutes_default: string
  status: VenueStatus
  facilities: Record<string, { quantity: string; notes: string }>
  layouts: Record<string, { layout_capacity: string }>
  accessibility_features: Record<string, { notes: string }>
}

const EMPTY: FormState = {
  name: '',
  location: '',
  capacity: '',
  description: '',
  floor_area_sqm: '',
  operating_hours_start: '',
  operating_hours_end: '',
  operating_notes: '',
  setup_minutes_default: '0',
  teardown_minutes_default: '0',
  status: 'ACTIVE',
  facilities: {},
  layouts: {},
  accessibility_features: {},
}

function fromVenue(venue: Venue): FormState {
  return {
    name: venue.name,
    location: venue.location,
    capacity: String(venue.capacity),
    description: venue.description ?? '',
    floor_area_sqm: venue.floor_area_sqm ?? '',
    operating_hours_start: venue.operating_hours_start?.slice(0, 5) ?? '',
    operating_hours_end: venue.operating_hours_end?.slice(0, 5) ?? '',
    operating_notes: venue.operating_notes ?? '',
    setup_minutes_default: String(venue.setup_minutes_default),
    teardown_minutes_default: String(venue.teardown_minutes_default),
    status: venue.status,
    facilities: Object.fromEntries(
      venue.facilities.map((f) => [
        f.code,
        { quantity: f.quantity?.toString() ?? '', notes: f.notes ?? '' },
      ]),
    ),
    layouts: Object.fromEntries(
      venue.layouts.map((l) => [l.code, { layout_capacity: l.layout_capacity?.toString() ?? '' }]),
    ),
    accessibility_features: Object.fromEntries(
      venue.accessibility_features.map((a) => [a.code, { notes: a.notes ?? '' }]),
    ),
  }
}

const WHOLE_NUMBER = /^\d+$/

/** Client-side mirror of the backend rules so users get instant feedback (backend still decides). */
function validate(form: FormState): string | null {
  if (!form.name.trim()) return 'Name is required.'
  if (!form.location.trim()) return 'Location is required.'
  if (!WHOLE_NUMBER.test(form.capacity) || Number(form.capacity) <= 0) {
    return 'Capacity must be a positive whole number.'
  }
  if (!form.operating_hours_start !== !form.operating_hours_end) {
    return 'Enter both opening and closing time, or neither.'
  }
  if (form.operating_hours_start && form.operating_hours_end <= form.operating_hours_start) {
    return 'Closing time must be after opening time.'
  }
  for (const field of ['setup_minutes_default', 'teardown_minutes_default'] as const) {
    if (!WHOLE_NUMBER.test(form[field])) return 'Setup and teardown minutes must be whole numbers.'
  }
  for (const [code, f] of Object.entries(form.facilities)) {
    if (f.quantity && (!WHOLE_NUMBER.test(f.quantity) || Number(f.quantity) <= 0)) {
      return `Quantity for ${code} must be a positive whole number.`
    }
  }
  for (const [code, l] of Object.entries(form.layouts)) {
    if (
      l.layout_capacity &&
      (!WHOLE_NUMBER.test(l.layout_capacity) || Number(l.layout_capacity) <= 0)
    ) {
      return `Capacity for layout ${code} must be a positive whole number.`
    }
  }
  return null
}

function toInput(form: FormState, editing: boolean): VenueInput {
  const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
  const numOrNull = (value: string) => (value.trim() === '' ? null : Number(value))
  return {
    name: form.name.trim(),
    location: form.location.trim(),
    capacity: Number(form.capacity),
    description: orNull(form.description),
    floor_area_sqm: orNull(form.floor_area_sqm),
    operating_hours_start: orNull(form.operating_hours_start),
    operating_hours_end: orNull(form.operating_hours_end),
    operating_notes: orNull(form.operating_notes),
    setup_minutes_default: Number(form.setup_minutes_default || 0),
    teardown_minutes_default: Number(form.teardown_minutes_default || 0),
    facilities: Object.entries(form.facilities).map(([code, f]) => ({
      code,
      quantity: numOrNull(f.quantity),
      notes: orNull(f.notes),
    })),
    layouts: Object.entries(form.layouts).map(([code, l]) => ({
      code,
      layout_capacity: numOrNull(l.layout_capacity),
    })),
    accessibility_features: Object.entries(form.accessibility_features).map(([code, a]) => ({
      code,
      notes: orNull(a.notes),
    })),
    ...(editing ? { status: form.status } : {}),
  }
}

/** Story 8.3 - create (/venues/new) and edit (/venues/:id/edit) a venue record. */
export function VenueFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [reference, setReference] = useState<VenueReferenceData | null>(null)
  const [form, setForm] = useState<FormState | null>(editing ? null : EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchVenueReferenceData(), id ? getVenue(id) : Promise.resolve(null)])
      .then(([ref, venue]) => {
        if (cancelled) return
        setReference(ref)
        if (venue) setForm(fromVenue(venue))
      })
      .catch((err) => {
        if (!cancelled) setError(formatApiError(err))
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error && !form) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    )
  }
  if (!form || !reference) return <p className="muted">Loading…</p>

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current))

  function toggle<K extends 'facilities' | 'layouts' | 'accessibility_features'>(
    group: K,
    code: string,
    empty: FormState[K][string],
  ) {
    setForm((current) => {
      if (!current) return current
      const next = { ...current[group] } as FormState[K]
      if (code in next) delete next[code]
      else next[code] = empty
      return { ...current, [group]: next }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    const problem = validate(form)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const input = toInput(form, editing)
      const saved = id ? await updateVenue(id, input) : await createVenue(input)
      navigate('/venues/manage', {
        state: { flash: `Venue "${saved.name}" ${editing ? 'updated' : 'created'}.` },
      })
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="page-header">
        <h1>{editing ? `Edit venue: ${form.name}` : 'New venue'}</h1>
        <Link to="/venues/manage">Back to list</Link>
      </div>

      <form className="venue-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="card">
          <legend>Basics</legend>
          <label>
            Name <span className="req">*</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label>
            Location <span className="req">*</span>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              required
            />
          </label>
          <label>
            Capacity (people) <span className="req">*</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
              required
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>
          <label>
            Floor area (m²)
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.floor_area_sqm}
              onChange={(e) => set('floor_area_sqm', e.target.value)}
            />
          </label>
          {editing && (
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as VenueStatus)}
              >
                <option value="ACTIVE">Active (in service)</option>
                <option value="WITHDRAWN">Withdrawn from service</option>
              </select>
            </label>
          )}
        </fieldset>

        <fieldset className="card">
          <legend>Operating information</legend>
          <div className="row">
            <label>
              Opens
              <input
                type="time"
                value={form.operating_hours_start}
                onChange={(e) => set('operating_hours_start', e.target.value)}
              />
            </label>
            <label>
              Closes
              <input
                type="time"
                value={form.operating_hours_end}
                onChange={(e) => set('operating_hours_end', e.target.value)}
              />
            </label>
          </div>
          <div className="row">
            <label>
              Default setup (minutes)
              <input
                type="number"
                min={0}
                step={1}
                value={form.setup_minutes_default}
                onChange={(e) => set('setup_minutes_default', e.target.value)}
              />
            </label>
            <label>
              Default teardown (minutes)
              <input
                type="number"
                min={0}
                step={1}
                value={form.teardown_minutes_default}
                onChange={(e) => set('teardown_minutes_default', e.target.value)}
              />
            </label>
          </div>
          <label>
            Operating notes
            <textarea
              rows={2}
              value={form.operating_notes}
              onChange={(e) => set('operating_notes', e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="card">
          <legend>Facilities</legend>
          <ul className="check-list">
            {reference.facilities.map((item) => {
              const selected = form.facilities[item.code]
              return (
                <li key={item.code}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={() => toggle('facilities', item.code, { quantity: '', notes: '' })}
                    />
                    {item.name}
                  </label>
                  {selected && (
                    <span className="inline-fields">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="qty"
                        aria-label={`${item.name} quantity`}
                        value={selected.quantity}
                        onChange={(e) =>
                          set('facilities', {
                            ...form.facilities,
                            [item.code]: { ...selected, quantity: e.target.value },
                          })
                        }
                      />
                      <input
                        placeholder="notes"
                        aria-label={`${item.name} notes`}
                        value={selected.notes}
                        onChange={(e) =>
                          set('facilities', {
                            ...form.facilities,
                            [item.code]: { ...selected, notes: e.target.value },
                          })
                        }
                      />
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="card">
          <legend>Supported room layouts</legend>
          <ul className="check-list">
            {reference.layouts.map((item) => {
              const selected = form.layouts[item.code]
              return (
                <li key={item.code}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={() => toggle('layouts', item.code, { layout_capacity: '' })}
                    />
                    {item.name}
                  </label>
                  {selected && (
                    <span className="inline-fields">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="capacity in this layout"
                        aria-label={`${item.name} capacity`}
                        value={selected.layout_capacity}
                        onChange={(e) =>
                          set('layouts', {
                            ...form.layouts,
                            [item.code]: { layout_capacity: e.target.value },
                          })
                        }
                      />
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="card">
          <legend>Accessibility features</legend>
          <ul className="check-list">
            {reference.accessibility_features.map((item) => {
              const selected = form.accessibility_features[item.code]
              return (
                <li key={item.code}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={() => toggle('accessibility_features', item.code, { notes: '' })}
                    />
                    {item.name}
                  </label>
                  {selected && (
                    <span className="inline-fields">
                      <input
                        placeholder="notes"
                        aria-label={`${item.name} notes`}
                        value={selected.notes}
                        onChange={(e) =>
                          set('accessibility_features', {
                            ...form.accessibility_features,
                            [item.code]: { notes: e.target.value },
                          })
                        }
                      />
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create venue'}
          </button>
          <Link to="/venues/manage" className="button secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}
