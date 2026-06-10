import { createContext, useContext, useEffect, useState } from 'react'
import { API_BASE } from '../api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'pitchforge_token'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true) // true until session is restored

  // On mount — restore session from localStorage token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => setUser(data))
      .catch(() => localStorage.removeItem(TOKEN_KEY)) // expired / invalid
      .finally(() => setLoading(false))
  }, [])

  /**
   * Called by the Login page after Google returns an id_token.
   * Exchanges the Google token for our JWT, stores it, fetches user profile.
   */
  async function login(googleAccessToken) {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ access_token: googleAccessToken }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail === 'account_blocked' ? 'account_blocked' : 'Auth failed')
    }

    const { access_token } = await res.json()
    localStorage.setItem(TOKEN_KEY, access_token)

    const me = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!me.ok) throw new Error('Failed to fetch user')
    setUser(await me.json())
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  /** Attach the stored JWT to any fetch call that needs auth */
  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY)
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authHeaders }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
