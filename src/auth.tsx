import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { getToken, setToken } from './api'
import type { User } from './types'

type Ctx = { user: User | null; token: string | null; signIn: (t: string, u: User) => void; signOut: () => void }
const AuthCtx = createContext<Ctx>(null!)
const USER_KEY = 'glob_user'

function loadUser(): User | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState(getToken())
  const [user, setUser] = useState<User | null>(loadUser())

  const signIn = useCallback((t: string, u: User) => {
    setToken(t); localStorage.setItem(USER_KEY, JSON.stringify(u)); setTok(t); setUser(u)
  }, [])
  const signOut = useCallback(() => {
    setToken(null); localStorage.removeItem(USER_KEY); setTok(null); setUser(null)
  }, [])

  return <AuthCtx.Provider value={{ user: token ? user : null, token, signIn, signOut }}>{children}</AuthCtx.Provider>
}
export const useAuth = () => useContext(AuthCtx)
