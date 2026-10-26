import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { identifyUser, resetAnalytics, track } from '@/lib/analytics'
import { fetchMitWiederholung, antwortLesen } from '@/lib/api'

/**
 * Nutzdaten eines Tokens lesen, ohne Prüfung - die macht der Server.
 *
 * Über TextDecoder, weil `atob` Bytes liefert: Ein Name mit Umlaut kam
 * sonst als "PrÃ¼fer" an (gemessen am 26.10.2026).
 */
function tokenInhalt(token: string): any {
  try {
    const roh = atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(roh, c => c.charCodeAt(0))))
  } catch {
    return null
  }
}

/**
 * Beim Abmelden auch auf dem Server aufräumen. Läuft im Hintergrund weiter,
 * während die Anmeldeseite schon steht.
 *
 * Erst das Push-Abo dieses Browsers (es gehört dem abgemeldeten Konto, sonst
 * kämen dessen Benachrichtigungen hier weiter an - Fund 96), dann die Sitzung
 * selbst: Vorher galt das Token nach "Abmelden" weiter, und die Geräteliste
 * zeigte die Sitzung als aktiv (gemessen am 26.10.2026).
 */
async function serverseitigAbmelden(token: string): Promise<void> {
  const anmeldung = { Authorization: `Bearer ${token}` }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const abo = await reg?.pushManager?.getSubscription()
    if (abo) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { ...anmeldung, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: abo.endpoint }),
      }).catch(() => undefined)
      await abo.unsubscribe()
    }
  } catch { /* ohne Service Worker kein Abo */ }
  const sid = tokenInhalt(token)?.sid
  if (sid) {
    await fetch(`/api/auth/sessions/${encodeURIComponent(sid)}`, { method: 'DELETE', headers: anmeldung })
      .catch(() => undefined)
  }
}

interface User {
  id: number
  email: string
  name: string
  role: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string, code?: string) => Promise<void>
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
  const queryClient = useQueryClient()

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev)
  }, [])

  const logout = useCallback(() => {
    const altesToken = localStorage.getItem('token')
    if (altesToken) void serverseitigAbmelden(altesToken)
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    // Abfragen des abgemeldeten Kontos verwerfen: Sonst sah die nächste
    // Person am selben Gerät dessen Projektliste (gemessen am 26.10.2026).
    queryClient.clear()
    resetAnalytics()
    // Offline-Kopien der API gehören zum abgemeldeten Konto - auf einem
    // geteilten Set-Tablet darf die nächste Person sie nicht sehen
    if ('caches' in window) {
      caches.delete('api-cache').catch(() => {})
      caches.delete('set-offline').catch(() => {})
    }
  }, [queryClient])

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
      // selbst nach. Den Nutzer aus dem Token lesen, damit die Oberfläche steht.
      .catch(() => {
        const p = tokenInhalt(token)
        if (!p || (p.exp && p.exp * 1000 < Date.now())) return logout()
        if (p.id) setUser({ id: p.id, email: p.email, name: p.name, role: p.role })
      })
      .finally(() => setIsLoading(false))
  }, [token, logout])

  const login = async (email: string, password: string, code?: string) => {
    const r = await fetchMitWiederholung('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, code })
    })
    const { data, error } = await antwortLesen(r)
    if (error) {
      // Der Server fragt nach dem zweiten Faktor. Die Anmeldeseite soll das
      // Code-Feld zeigen statt eine Fehlermeldung.
      const fehler: any = new Error(error)
      if (data?.zweiter_faktor) fehler.zweiterFaktor = true
      throw fehler
    }
    // Auch ohne vorheriges Abmelden (Sitzung abgelaufen, Anmeldeseite direkt
    // aufgerufen) keine Daten des vorigen Kontos stehen lassen
    queryClient.clear()
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
    queryClient.clear()
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
