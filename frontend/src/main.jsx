import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <MotionConfig reducedMotion="never">
        <App />
      </MotionConfig>
    </AuthProvider>
  </GoogleOAuthProvider>
)
