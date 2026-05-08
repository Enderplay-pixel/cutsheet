import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

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
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }, [])

  useEffect(() => {
    if (!token) { setIsLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(({ data, error }) => {
        if (error) logout()
        else setUser(data)
      })
      .catch(logout)
      .finally(() => setIsLoading(false))
  }, [token, logout])

  const login = async (email: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const { data, error } = await r.json()
    if (error) throw new Error(error)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
  }

  const register = async (email: string, password: string, name: string) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })
    const { data, error } = await r.json()
    if (error) throw new Error(error)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
