import { createContext, useContext } from 'react'
import type { CurrentUser } from '../api/auth'

export interface AuthContextValue {
  /** The signed-in user, or null when signed out. */
  user: CurrentUser | null
  /** True until the initial `/auth/me` lookup has finished. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<CurrentUser>
  signOut: () => Promise<void>
  /** Story 1.2 AC2: hide navigation / actions the role may not perform. */
  can: (permission: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
