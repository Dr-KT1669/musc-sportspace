import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { User } from '../lib/types'

type AuthValue = {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  setUser: (user: User | null) => void
  setCoins: (coins: number) => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await api<{ user: User }>('/api/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      refresh,
      setUser,
      setCoins: (coins: number) => setUser((current) => (current ? { ...current, coinBalance: coins } : current)),
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('auth')
  return ctx
}
