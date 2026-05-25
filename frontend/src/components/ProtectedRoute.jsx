import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps any route that requires authentication.
 * - While session is being restored from localStorage: render nothing (avoids flash).
 * - No user after restore: redirect to /login.
 * - Authenticated: render children normally.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />
  return children
}
