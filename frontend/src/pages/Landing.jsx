import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

const METRICS = [
  { label: 'Avg Fit Score', value: '82', sub: 'out of 100' },
  { label: 'Time Saved', value: '40 minutes', sub: 'per proposal' },
]

const STEPS = [
  { n: '01', label: 'Analyze' },
  { n: '02', label: 'Score' },
  { n: '03', label: 'Draft' },
  { n: '04', label: 'Approve' },
]

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Analyze',
    body: 'Paste any job posting. The pipeline extracts required skills, infers client budget signals, tone, and what they actually need beyond the listed requirements.',
  },
  {
    n: '02',
    title: 'Score',
    body: 'Get a fit score from 0–100. See exactly which skills match your profile and which gaps exist — so you can decide whether to apply before spending any time writing.',
  },
  {
    n: '03',
    title: 'Draft',
    body: 'Your proposal is written in plain language, priced relative to your experience, and tuned to the client\'s specific signals. A built-in critic refines it in a loop until quality is high.',
  },
  {
    n: '04',
    title: 'Approve',
    body: 'Review the draft, give feedback to refine further, or approve it when it\'s ready. Download as .txt or copy to clipboard and send.',
  },
]

export default function Landing() {
  const navigate    = useNavigate()
  const hiwRef      = useRef(null)
  const { user, loading, logout } = useAuth()
  const [menuOpen, setMenuOpen]   = useState(false)
  const menuRef                   = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  function handleLogout() {
    setMenuOpen(false)
    logout()
  }

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await login(tokenResponse.access_token)
        navigate('/new')
      } catch {
        console.error('Login failed')
      }
    },
    onError: () => console.error('Google login error'),
  })

  useEffect(() => {
    const el = hiwRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('in-view'); observer.disconnect() } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scrollToHIW = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <style>{css}</style>
      <div className="page">

        {/* ── Hero frame (full viewport) ── */}
        <div className="hero-frame">

        {/* ── Navbar ── */}
        <div className="nav-wrapper">
          <nav className="nav">
            <Logo />
            <div className="nav-links">
              <a className="nav-link" href="https://github.com/HassanAbdullahHere/pitchforge" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <button className="nav-link nav-link-btn" onClick={scrollToHIW}>How It Works</button>
            </div>
            {!loading && (
              user ? (
                <div className="avatar-wrap" ref={menuRef}>
                  <div className="nav-avatar" onClick={() => setMenuOpen(o => !o)}>
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt={user.name} className="avatar-img" />
                      : <span className="avatar-initial">{user.name[0].toUpperCase()}</span>
                    }
                  </div>
                  {menuOpen && (
                    <div className="avatar-menu">
                      <div className="menu-user-info">
                        <div className="menu-avatar-lg">
                          {user.avatar_url
                            ? <img src={user.avatar_url} alt={user.name} className="avatar-img" />
                            : <span className="menu-initial">{user.name[0].toUpperCase()}</span>
                          }
                        </div>
                        <div className="menu-user-text">
                          <span className="menu-name">{user.name}</span>
                          <span className="menu-email">{user.email}</span>
                        </div>
                      </div>
                      <div className="menu-divider" />
                      <button className="menu-item" onClick={() => setMenuOpen(false)}>
                        <span className="menu-item-icon">◎</span>
                        Profile
                        <span className="menu-item-soon">soon</span>
                      </button>
                      <div className="menu-divider" />
                      <button className="menu-item menu-item--danger" onClick={handleLogout}>
                        <span className="menu-item-icon">→</span>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button className="btn-google" onClick={() => googleLogin()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in
                </button>
              )
            )}
          </nav>
        </div>

        {/* ── Hero ── */}
        <main className="hero">
          <div className="hero-left">
            <div className="badge-pill anim" style={{ '--delay': '0ms' }}>
              ✦ AI Proposal Intelligence
            </div>

            <h1 className="headline anim" style={{ '--delay': '80ms' }}>
              Forge Proposals<br />That Win.
            </h1>

            <p className="subtitle anim" style={{ '--delay': '160ms' }}>
              Paste a job posting. Walk away with a proposal that sounds like you,
              scores your fit, prices your work, and wins the client.
            </p>

            <div className="cta-row anim" style={{ '--delay': '240ms' }}>
              <button className="btn-primary btn-lg" onClick={() => navigate('/new')}>
                Get Started →
              </button>
              <button className="btn-secondary btn-lg" onClick={scrollToHIW}>
                How It Works
              </button>
            </div>

            <div className="process-strip anim" style={{ '--delay': '320ms' }}>
              {STEPS.map((step, i) => (
                <div key={step.n} className="process-step">
                  <span className="process-n">{step.n}</span>
                  <span className="process-label">{step.label}</span>
                  {i < STEPS.length - 1 && (
                    <span className="process-sep" aria-hidden="true">›</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="hero-right">
            {METRICS.map((m, i) => (
              <div
                key={m.label}
                className="metric-card anim"
                style={{ '--delay': `${200 + i * 90}ms` }}
              >
                <span className="metric-value">{m.value}</span>
                <span className="metric-label">{m.label}</span>
                <span className="metric-sub">{m.sub}</span>
              </div>
            ))}
            <div className="metric-card powered-card anim" style={{ '--delay': '380ms' }}>
              <span className="powered-label">Powered by</span>
              <div className="powered-badges">
                <div className="tech-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <defs>
                      <linearGradient id="gem-g" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#4285F4"/>
                        <stop offset="55%" stopColor="#9B72CB"/>
                        <stop offset="100%" stopColor="#0F9D58"/>
                      </linearGradient>
                    </defs>
                    <path d="M12 2C11.6 5.8 9.2 9.2 5 11c-.4.2-.4.8 0 1 4.2 1.8 6.6 5.2 7 9 0 .5.7.5.7 0 .5-3.8 2.9-7.2 7-9 .4-.2.4-.8 0-1-4.1-1.8-6.5-5.2-7-9C12.7 1.5 12 1.5 12 2Z" fill="url(#gem-g)"/>
                  </svg>
                  <span className="tech-badge-name">Gemini</span>
                </div>
                <div className="tech-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="5" cy="12" r="3" fill="#1C7A4B"/>
                    <circle cx="19.5" cy="5.5" r="3" fill="#1C7A4B"/>
                    <circle cx="19.5" cy="18.5" r="3" fill="#1C7A4B"/>
                    <line x1="7.8" y1="10.8" x2="16.7" y2="6.7" stroke="#1C7A4B" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="7.8" y1="13.2" x2="16.7" y2="17.3" stroke="#1C7A4B" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span className="tech-badge-name tech-badge-name-green">LangGraph</span>
                </div>
              </div>
            </div>
          </div>
        </main>
        </div>{/* end hero-frame */}

        {/* ── How It Works ── */}
        <section className="hiw-section" id="how-it-works" ref={hiwRef}>
          <div className="hiw-inner">
            <div className="hiw-header">
              <span className="hiw-overline">Process</span>
              <h2 className="hiw-title">How It Works</h2>
              <p className="hiw-sub">Four steps from raw job posting to a proposal ready to send.</p>
            </div>

            <div className="hiw-grid">
              {HOW_IT_WORKS.map((step, i) => (
                <div
                  key={step.n}
                  className="hiw-card hiw-anim"
                  style={{ '--hiw-delay': `${i * 80}ms` }}
                >
                  <span className="hiw-n">{step.n}</span>
                  <h3 className="hiw-card-title">{step.title}</h3>
                  <p className="hiw-card-body">{step.body}</p>
                </div>
              ))}
            </div>

            <div className="hiw-cta">
              <button className="btn-primary btn-lg" onClick={() => navigate('/new')}>
                Try It Now →
              </button>
            </div>
          </div>
        </section>

      </div>
    </>
  )
}

const css = `
  :root {
    --text-dark:       rgba(30,36,25,0.85);
    --text-muted:      rgba(30,36,25,0.45);
    --text-light:      rgba(255,255,255,0.88);
    --text-light-muted:rgba(255,255,255,0.4);
    --glass-light:     rgba(255,255,255,0.68);
    --glass-light-b:   rgba(255,255,255,0.82);
    --glass-dark:      rgba(22,26,20,0.75);
    --glass-dark-b:    rgba(255,255,255,0.09);
    --accent:          #7ab87a;
    --accent-bg:       rgba(122,184,122,0.15);
    --font:            'Instrument Sans', sans-serif;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes hiwFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .anim {
    opacity: 0;
    animation: fadeUp 400ms ease forwards;
    animation-delay: var(--delay, 0ms);
  }

  /* ── Page wrapper ── */
  .page {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
  }

  /* ── Hero frame — one full viewport ── */
  .hero-frame {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Navbar ── */
  .nav-wrapper {
    position: sticky;
    top: 16px;
    z-index: 100;
    display: flex;
    justify-content: center;
    padding: 0 24px;
    pointer-events: none;
  }

  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    width: 100%;
    max-width: 1400px;
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.85);
    border-radius: 100px;
    box-shadow: 0 4px 24px rgba(30,36,25,0.08), 0 1px 4px rgba(30,36,25,0.04);
    pointer-events: auto;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .nav-link {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    color: rgba(30,36,25,0.65);
    text-decoration: none;
    letter-spacing: -0.01em;
    transition: color 200ms;
  }
  .nav-link:hover { color: var(--text-dark); }

  .nav-link-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .btn-google {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 100px;
    background: rgba(26,31,22,0.88);
    color: rgba(255,255,255,0.92);
    border: none;
    padding: 8px 18px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: box-shadow 200ms, transform 200ms;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  }
  .btn-google:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.28);
    transform: translateY(-1px);
  }
  .btn-google:active { transform: translateY(0); box-shadow: none; }

  /* ── Avatar + dropdown wrapper ── */
  .avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .nav-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid rgba(30,36,25,0.15);
    background: rgba(26,31,22,0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 200ms, box-shadow 200ms;
    user-select: none;
  }
  .nav-avatar:hover {
    transform: scale(1.06);
    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  }
  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .avatar-initial {
    font-family: var(--font);
    font-size: 16px;
    font-weight: 600;
    color: rgba(255,255,255,0.92);
    text-transform: uppercase;
    line-height: 1;
  }

  /* ── Dropdown menu ── */
  .avatar-menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 240px;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.95);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(30,36,25,0.14), 0 2px 8px rgba(30,36,25,0.06);
    padding: 8px;
    z-index: 200;
    animation: menuFadeIn 160ms ease both;
  }
  @keyframes menuFadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* User info block */
  .menu-user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 10px 12px;
  }
  .menu-avatar-lg {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background: rgba(26,31,22,0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1.5px solid rgba(30,36,25,0.1);
  }
  .menu-initial {
    font-family: var(--font);
    font-size: 16px;
    font-weight: 600;
    color: rgba(255,255,255,0.92);
    text-transform: uppercase;
    line-height: 1;
  }
  .menu-user-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }
  .menu-name {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: rgba(30,36,25,0.88);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .menu-email {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 400;
    color: rgba(30,36,25,0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Divider */
  .menu-divider {
    height: 1px;
    background: rgba(30,36,25,0.07);
    margin: 4px 0;
  }

  /* Menu items */
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: rgba(30,36,25,0.75);
    text-align: left;
    transition: background 150ms;
  }
  .menu-item:hover {
    background: rgba(30,36,25,0.05);
    color: rgba(30,36,25,0.9);
  }
  .menu-item--danger { color: rgba(185,40,40,0.8); }
  .menu-item--danger:hover {
    background: rgba(185,40,40,0.06);
    color: rgba(185,40,40,1);
  }
  .menu-item-icon {
    font-size: 13px;
    opacity: 0.6;
    flex-shrink: 0;
  }
  .menu-item-soon {
    margin-left: auto;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(30,36,25,0.3);
    background: rgba(30,36,25,0.06);
    border-radius: 100px;
    padding: 2px 7px;
  }

  /* ── Buttons ── */
  .btn-primary {
    border-radius: 100px;
    background: rgba(26,31,22,0.88);
    color: rgba(255,255,255,0.92);
    border: none;
    padding: 12px 24px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 200ms;
    letter-spacing: -0.01em;
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.22); }
  .btn-primary:active { transform: translateY(0); box-shadow: none; }

  .btn-secondary {
    border-radius: 100px;
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    color: rgba(30,36,25,0.8);
    padding: 12px 24px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 200ms;
    letter-spacing: -0.01em;
  }
  .btn-secondary:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.10); }
  .btn-secondary:active { transform: translateY(0); box-shadow: none; }

  .btn-lg { padding: 14px 28px; font-size: 15px; }

  /* ── Hero layout ── */
  .hero {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 60px;
    padding: 60px 40px 80px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .hero-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 560px;
  }

  .hero-right {
    flex: 0 0 260px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    perspective: 800px;
  }

  /* ── Badge pill ── */
  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    border-radius: 100px;
    padding: 6px 14px;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    color: rgba(30,36,25,0.7);
    letter-spacing: -0.005em;
    width: fit-content;
  }

  /* ── Headline ── */
  .headline {
    font-family: var(--font);
    font-size: clamp(2.8rem, 6vw, 4.2rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.08;
    color: var(--text-dark);
  }

  /* ── Subtitle ── */
  .subtitle {
    font-family: var(--font);
    font-size: 16px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.7;
    color: rgba(30,36,25,0.6);
    max-width: 480px;
  }

  /* ── CTA row ── */
  .cta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ── Process strip ── */
  .process-strip {
    display: flex;
    align-items: center;
    gap: 0;
    padding-top: 8px;
    flex-wrap: wrap;
  }

  .process-step {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .process-n {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(30,36,25,0.38);
  }

  .process-label {
    font-family: var(--font);
    font-size: 13px;
    font-weight: 900;
    letter-spacing: -0.01em;
    color: rgba(12, 12, 11, 0.38);
  }

  .process-sep {
    font-size: 14px;
    color: rgba(30,36,25,0.18);
    margin: 0 10px;
  }

  /* ── Metric cards (dark glass) ── */
  .metric-card {
    background: var(--glass-dark);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-dark-b);
    border-radius: 20px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transform-style: preserve-3d;
    transform: rotateX(0deg) rotateY(0deg) translateZ(0);
    transition: transform 400ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 400ms ease;
    will-change: transform;
    cursor: default;
  }

  .metric-card:hover {
    transform: rotateX(-6deg) rotateY(8deg) translateZ(8px);
    box-shadow: -6px 16px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
  }

  .metric-value {
    font-family: var(--font);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: var(--text-light);
    line-height: 1.1;
  }

  .metric-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-light-muted);
    margin-top: 4px;
  }

  .metric-sub {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: rgba(255,255,255,0.25);
  }

  .powered-card {
    border-color: rgba(255,255,255,0.12);
    gap: 10px;
  }

  .powered-label {
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
  }

  .powered-badges {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .tech-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    padding: 7px 12px;
  }

  .tech-badge-name {
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: rgba(255,255,255,0.85);
  }

  .tech-badge-name-green {
    color: #4ade80;
  }

  /* ── How It Works section ── */
  .hiw-section {
    position: relative;
    z-index: 1;
    padding: 80px 40px 100px;
  }

  .hiw-inner {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 48px;
  }

  .hiw-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .hiw-overline {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .hiw-title {
    font-family: var(--font);
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.1;
    color: var(--text-dark);
  }

  .hiw-sub {
    font-family: var(--font);
    font-size: 15px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: rgba(30,36,25,0.5);
    max-width: 420px;
    line-height: 1.6;
  }

  /* ── HIW cards grid ── */
  .hiw-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    width: 100%;
  }

  .hiw-card {
    background: var(--glass-light);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-light-b);
    border-radius: 20px;
    padding: 28px 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    opacity: 0;
  }

  .hiw-anim {
    animation: hiwFadeUp 480ms ease forwards;
    animation-delay: var(--hiw-delay, 0ms);
    animation-play-state: paused;
  }

  .hiw-section:hover .hiw-anim,
  .hiw-section.in-view .hiw-anim {
    animation-play-state: running;
  }

  .hiw-n {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .hiw-card-title {
    font-family: var(--font);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-dark);
    line-height: 1.2;
  }

  .hiw-card-body {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.65;
    color: rgba(30,36,25,0.6);
  }

  .hiw-cta {
    padding-top: 8px;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .nav-wrapper { top: 10px; padding: 0 12px; }
    .nav { padding: 10px 16px; border-radius: 20px; }
    .nav-links { display: none; }

    .hero {
      flex-direction: column;
      gap: 40px;
      padding: 40px 20px 60px;
    }

    .hero-right {
      flex-direction: row;
      flex-wrap: wrap;
      flex: unset;
      width: 100%;
      gap: 10px;
    }

    .metric-card {
      flex: 1;
      min-width: 140px;
    }

    .headline { font-size: clamp(2.2rem, 10vw, 2.8rem); }

    .hiw-section { padding: 60px 20px 80px; }

    .hiw-grid {
      grid-template-columns: 1fr;
    }
  }
`
