import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { identifyUser, resetAnalytics, track } from '@/lib/analytics'
import { fetchMitWiederholung, antwortLesen } from '@/lib/api'

interface User {
  id: number
  email: string
  name: string
  role: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  updateUser: (partial: Partial<User>) => void
  isLoading: boolean
  justRegistered: boolean
  clearJustRegistered: () => void
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)
  const [justRegistered, setJustRegistered] = useState(false)
  const clearJustRegistered = () => setJustRegistered(false)

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    resetAnalytics()
    // Offline-Kopien der API gehören zum abgemeldeten Konto - auf einem
    // geteilten Set-Tablet darf die nächste Person sie nicht sehen
    if ('caches' in window) {
      caches.delete('api-cache').catch(() => {})
      caches.delete('set-offline').catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!token) { setIsLoading(false); return }
    fetchMitWiederholung('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        // Nur ein abgelehntes Token meldet ab. Ein Aussetzer des Servers
        // (503, 502, Netzwerk) darf nicht alle Nutzer gleichzeitig abmelden.
        if (r.status === 401 || r.status === 403) return { data: null, error: 'abgelaufen' }
        if (!r.ok) throw new Error('Server nicht erreichbar')
        return antwortLesen(r)
      })
      .then(({ data, error }) => {
        if (error) logout()
        else {
          setUser(data)
          if (data) identifyUser(data)
        }
      })
      // Server kurz weg: angemeldet bleiben, die Seiten laden ihre Daten
      // selbst nach. Den Nutzer aus dem Token lesen, damit die Oberflaeche steht.
      .catch(() => {
        try {
          const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (p?.exp && p.exp * 1000 < Date.now()) return logout()
          if (p?.id) setUser({ id: p.id, email: p.email, name: p.name, role: p.role })
        } catch { logout() }
      })
      .finally(() => setIsLoading(false))
  }, [token, logout])

  const login = async (email: string, password: string) => {
    const r = await fetchMitWiederholung('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const { data, error } = await antwortLesen(r)
    if (error) throw new Error(error)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
    identifyUser(data.user)
  }

  const register = async (email: string, password: string, name: string) => {
    const r = await fetchMitWiederholung('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })
    const { data, error } = await antwortLesen(r)
    if (error) throw new Error(error)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
    setJustRegistered(true)
    identifyUser(data.user)
    track('signup')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, isLoading, justRegistered, clearJustRegistered }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
