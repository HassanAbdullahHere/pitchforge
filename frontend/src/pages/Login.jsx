import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate         = useNavigate()

  useEffect(() => {
    if (user) navigate('/new', { replace: true })
  }, [user, navigate])

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await login(tokenResponse.access_token)
        navigate('/new', { replace: true })
      } catch {
        console.error('Login failed')
      }
    },
    onError: () => console.error('Google login error'),
  })

  return (
    <>
      <style>{css}</style>
      <div className="login-page">
        <div className="login-card">
          <div className="logo-mark">⚒</div>
          <h1 className="title">PitchForge</h1>
          <p className="subtitle">Proposals that win contracts</p>

          <div className="divider" />

          <p className="prompt">Sign in to start writing</p>

          <button className="btn-google" onClick={() => googleLogin()}>
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          <p className="fine-print">
            Your profile and proposals are private to your account.
          </p>
        </div>
      </div>
    </>
  )
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=JetBrains+Mono:wght@400&display=swap');

  :root {
    --bg:           #0a0908;
    --gold:         #c9a84c;
    --gold-dim:     #8a6d2e;
    --ivory:        #f5f0e8;
    --ivory-dim:    #9c9389;
    --card-bg:      #111009;
    --border:       #2a2620;
    --font-display: 'Cormorant Garamond', serif;
    --font-mono:    'JetBrains Mono', monospace;
    --font:         'Instrument Sans', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); }

  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    padding: 1.5rem;
  }

  .login-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 3rem 2.5rem;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .logo-mark { font-size: 2rem; margin-bottom: 0.75rem; }

  .title {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 300;
    color: var(--gold);
    letter-spacing: 0.08em;
    margin-bottom: 0.35rem;
  }

  .subtitle {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--ivory-dim);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .divider {
    width: 40px;
    height: 1px;
    background: var(--gold-dim);
    margin: 1.75rem 0;
  }

  .prompt {
    font-family: var(--font-display);
    font-size: 1rem;
    color: var(--ivory-dim);
    margin-bottom: 1.5rem;
  }

  .btn-google {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fff;
    color: rgba(30,36,25,0.82);
    border: 1px solid rgba(30,36,25,0.14);
    border-radius: 100px;
    padding: 11px 24px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: box-shadow 200ms, transform 200ms;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    margin-bottom: 1.75rem;
  }
  .btn-google:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.16);
    transform: translateY(-1px);
  }
  .btn-google:active { transform: translateY(0); box-shadow: none; }

  .fine-print {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--ivory-dim);
    text-align: center;
    line-height: 1.6;
    opacity: 0.6;
  }
`
