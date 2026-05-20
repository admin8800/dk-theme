import { createContext, useContext } from 'react'
import type { SubscribeInfo, UserInfo } from '@/lib/api/types'
import type { LoginInput } from '@/lib/api/services/auth'

export type AuthContextValue = {
  token: string | null
  user: UserInfo | null
  subscribe: SubscribeInfo | null
  hydrated: boolean
  login: (values: LoginInput) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
