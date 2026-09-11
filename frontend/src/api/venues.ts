import { api } from './client'

export interface ReferenceItem {
  code: string
  name: string
  description: string | null
}

export interface VenueReferenceData {
  facilities: ReferenceItem[]
  layouts: ReferenceItem[]
  accessibility_features: ReferenceItem[]
}

export type VenueStatus = 'ACTIVE' | 'WITHDRAWN'

export interface VenueSummary {
  id: string
  name: string
  location: string
  capacity: number
  status: VenueStatus
}

export interface VenueFacility {
  code: string
  name: string
  quantity: number | null
  notes: string | null
}

export interface VenueLayout {
  code: string
  name: string
  layout_capacity: number | null
}

export interface VenueAccessibilityFeature {
  code: string
  name: string
  notes: string | null
}

export interface Venue extends VenueSummary {
  description: string | null
  floor_area_sqm: string | null
  operating_hours_start: string | null
  operating_hours_end: string | null
  operating_notes: string | null
  setup_minutes_default: number
  teardown_minutes_default: number
  facilities: VenueFacility[]
  layouts: VenueLayout[]
  accessibility_features: VenueAccessibilityFeature[]
  created_by_id: string | null
  created_at: string
  updated_at: string
}

/** Body for POST /venues and PATCH /venues/{id}. */
export interface VenueInput {
  name: string
  location: string
  capacity: number
  description: string | null
  floor_area_sqm: string | null
  operating_hours_start: string | null
  operating_hours_end: string | null
  operating_notes: string | null
  setup_minutes_default: number
  teardown_minutes_default: number
  facilities: { code: string; quantity: number | null; notes: string | null }[]
  layouts: { code: string; layout_capacity: number | null }[]
  accessibility_features: { code: string; notes: string | null }[]
  status?: VenueStatus
}

export function fetchVenueReferenceData(): Promise<VenueReferenceData> {
  return api<VenueReferenceData>('/venues/reference-data')
}

export function listVenues(includeWithdrawn = false): Promise<VenueSummary[]> {
  return api<VenueSummary[]>(`/venues?include_withdrawn=${includeWithdrawn}`)
}

export function getVenue(id: string): Promise<Venue> {
  return api<Venue>(`/venues/${id}`)
}

export function createVenue(input: VenueInput): Promise<Venue> {
  return api<Venue>('/venues', { method: 'POST', body: input })
}

export function updateVenue(id: string, input: Partial<VenueInput>): Promise<Venue> {
  return api<Venue>(`/venues/${id}`, { method: 'PATCH', body: input })
}
