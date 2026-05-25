import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate        = useNavigate()

  // Already logged in — skip the login page
  useEffect(() => {
    if (user) navigate('/new', { replace: true })
  }, [user, navigate])

  async function handleSuccess(credentialResponse) {
    try {
      await login(credentialResponse.credential)
      navigate('/new', { replace: true })
    } catch {
      // login() threw — Google button resets itself automatically
      console.error('Login failed')
    }
  }

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

          <div className="google-btn-wrap">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => console.error('Google login error')}
              theme="filled_black"
              shape="pill"
              size="large"
              text="signin_with"
            />
          </div>

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
    --fire:         #e8793a;
    --ivory:        #f5f0e8;
    --ivory-dim:    #9c9389;
    --card-bg:      #111009;
    --border:       #2a2620;
    --font-display: 'Cormorant Garamond', serif;
    --font-mono:    'JetBrains Mono', monospace;
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

  .logo-mark {
    font-size: 2rem;
    margin-bottom: 0.75rem;
  }

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
    margin-bottom: 0;
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

  .google-btn-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 1.75rem;
  }

  .fine-print {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--ivory-dim);
    text-align: center;
    line-height: 1.6;
    opacity: 0.6;
  }
`
