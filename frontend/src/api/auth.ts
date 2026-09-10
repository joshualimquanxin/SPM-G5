import { api } from './client'

/** Mirrors backend `UserOut` (app/auth/schemas.py). */
export interface CurrentUser {
  id: string
  email: string
  full_name: string
  role_code: string
  role_name: string
  is_internal: boolean
  organisation_id: string | null
  organisation_name: string | null
  /** Permission codes from backend/app/auth/permissions.py, e.g. "venues:manage". */
  permissions: string[]
}

export function login(email: string, password: string): Promise<CurrentUser> {
  return api<CurrentUser>('/auth/login', { method: 'POST', body: { email, password } })
}

export function logout(): Promise<void> {
  return api<void>('/auth/logout', { method: 'POST' })
}

export function fetchMe(): Promise<CurrentUser> {
  return api<CurrentUser>('/auth/me')
}
