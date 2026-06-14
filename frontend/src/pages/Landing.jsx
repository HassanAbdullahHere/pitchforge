import { useEffect, useRef, useState } from 'react'
import {
  motion, useSpring, useScroll, useTransform, useMotionValue, useInView,
} from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../api'

const WORKFLOW_DETAILS = [
  { step: 'Analyze', body: 'Paste a job post. PitchForge extracts scope, intent, required skills, budget clues, and delivery risk.' },
  { step: 'Score', body: 'Compare the opportunity against your profile so you know whether it deserves your time.' },
  { step: 'Position', body: 'Choose the proof, rate angle, and opening argument before any proposal is written.' },
  { step: 'Draft', body: 'Generate a specific proposal grounded in shipped work, then revise it before sending.' },
]

const SIGNALS = [
  { label: 'Suggested rate',  value: '$70/hr' },
  { label: 'Matched skills',  value: 'React Native, Expo, iOS, TestFlight' },
  { label: 'Missing skills',  value: 'Vercel, Supabase' },
]

const DECISION_POINTS = [
  { label: 'Fit score',         body: 'Compare the job against your actual profile before spending time on a draft.' },
  { label: 'Signal quality',    body: 'Catch vague budgets, unclear scope, and missing proof requirements early.' },
  { label: 'Positioning angle', body: 'Turn your strongest matching experience into the opening argument.' },
]

const DRAFT_LINES = [
  'I built a RAG-backed proposal workflow with FastAPI, pgvector, and LangGraph orchestration.',
  'For this project I would start by shipping a narrow prototype, then harden retrieval quality and evaluation.',
  'The fastest win is turning your existing content into a searchable assistant with measurable answer quality.',
]

const AUDIENCES = [
  { label: 'Freelance engineers',  body: 'Decide quickly which jobs match your stack and rate before spending energy on the proposal.' },
  { label: 'AI builders',          body: 'Turn RAG, agents, automation, and LLM project experience into specific client-facing proof.' },
  { label: 'Technical agencies',   body: 'Keep proposal quality consistent when multiple people are qualifying and drafting leads.' },
]

const PLATFORM_LOGOS = ['Upwork', 'Fiverr', 'Freelancer', 'Toptal', 'Contra', 'PeoplePerHour']
const INTRO_DURATION_MS = 2200
const INTRO_SEEN_KEY = 'pitchforge:intro-seen-this-session'

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.41 5.41 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.82.94 4.03l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  )
}

function TiltCard({ children, className, delay = 0 }) {
  const ref  = useRef(null)
  const rotX = useSpring(0, { stiffness: 200, damping: 25 })
  const rotY = useSpring(0, { stiffness: 200, damping: 25 })

  function onMove(e) {
    if (window.matchMedia('(hover: none)').matches) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const nx = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2)
    const ny = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2)
    rotX.set(-ny * 5)
    rotY.set( nx * 8)
  }
  function onLeave() { rotX.set(0); rotY.set(0) }

  return (
    <motion.article
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 80, delay }}
      viewport={{ once: true, margin: '-60px' }}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 800 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.article>
  )
}

export default function Landing() {
  const navigate  = useNavigate()
  const workflowRef   = useRef(null)
  const featuresRef   = useRef(null)
  const pricingRef    = useRef(null)
  const builtForRef   = useRef(null)
  const isWorkflowInView = useInView(workflowRef, { once: true, margin: '-80px' })
  const { user, loading, login, logout, authHeaders } = useAuth()
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [menuClosing,    setMenuClosing]    = useState(false)
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false)
  const [usage,          setUsage]          = useState(null)
  const [avatarError,    setAvatarError]    = useState(false)
  const [avatarLoaded,   setAvatarLoaded]   = useState(false)
  const [loginError,     setLoginError]     = useState(null)
  const [heroScore,      setHeroScore]      = useState(0)
  const [introComplete,  setIntroComplete]  = useState(() => {
    try {
      return window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const menuRef       = useRef(null)
  const menuCloseTimer = useRef(null)

  // ── 2.5D hero parallax ──────────────────────────────────────────
  const heroRef    = useRef(null)
  const panMouseX  = useMotionValue(0)
  const panMouseY  = useMotionValue(0)
  const panSX      = useSpring(panMouseX, { stiffness: 80, damping: 25 })
  const panSY      = useSpring(panMouseY, { stiffness: 80, damping: 25 })
  const backX      = useTransform(panSX, v => v * 0.18)
  const backY      = useTransform(panSY, v => v * 0.18)
  const midX       = useTransform(panSX, v => v * 0.55)
  const midY       = useTransform(panSY, v => v * 0.55)
  const frontX     = useTransform(panSX, v => v * 1.25)
  const frontY     = useTransform(panSY, v => v * 1.25)
  const tiltX      = useSpring(0, { stiffness: 180, damping: 28 })
  const tiltY      = useSpring(0, { stiffness: 180, damping: 28 })

  // ── sticky scroll scenes ─────────────────────────────────────────
  const productTrackRef = useRef(null)
  const { scrollYProgress: productScroll } = useScroll({
    target: productTrackRef,
    offset: ['start start', 'end end'],
  })
  const s1Op = useTransform(productScroll, [0, 0.22, 0.38], [1, 1, 0])
  const s1Y  = useTransform(productScroll, [0.22, 0.40],    [0, -22])
  const s2Op = useTransform(productScroll, [0.28, 0.46, 0.62, 0.78], [0, 1, 1, 0])
  const s2Y  = useTransform(productScroll, [0.28, 0.46],    [22, 0])
  const s3Op = useTransform(productScroll, [0.68, 0.82],    [0, 1])
  const s3Y  = useTransform(productScroll, [0.68, 0.82],    [22, 0])

  // ── CTA magnetic button ──────────────────────────────────────────
  const ctaBtnRef = useRef(null)
  const ctaX      = useSpring(0, { stiffness: 200, damping: 20 })
  const ctaY      = useSpring(0, { stiffness: 200, damping: 20 })

  // ── helpers ──────────────────────────────────────────────────────
  function closeMenu() {
    clearTimeout(menuCloseTimer.current)
    setMenuClosing(true)
    menuCloseTimer.current = setTimeout(() => {
      setMenuOpen(false); setMenuClosing(false); menuCloseTimer.current = null
    }, 140)
  }

  useEffect(() => {
    if (!menuOpen || !user) return
    fetch(`${API_BASE}/api/proposal/usage`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUsage(data) })
      .catch(() => {})
  }, [menuOpen])

  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu()
    }
    function handleKey(e) {
      if (e.key === 'Escape') { closeMenu(); setMobileNavOpen(false) }
    }
    if (menuOpen || mobileNavOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown',   handleKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown',   handleKey)
      clearTimeout(menuCloseTimer.current)
    }
  }, [menuOpen, mobileNavOpen])

  const googleLogin = useGoogleLogin({
    onSuccess: async tokenResponse => {
      try { await login(tokenResponse.access_token) }
      catch (e) {
        if (e.message === 'account_blocked')
          setLoginError('Your account has been suspended. Contact support.')
      }
    },
    onError: () => {},
  })

  function handleGetStarted()  { if (user) navigate('/new'); else googleLogin() }
  function handleLogout()      { closeMenu(); logout() }
  function scrollToWorkflow()  { document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' }) }
  function scrollToFeatures()  { featuresRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  function scrollToPricing()   { pricingRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  function scrollToBuiltFor()  { builtForRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  useEffect(() => {
    if (introComplete) return
    try {
      window.sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {}
    const timer = window.setTimeout(() => setIntroComplete(true), INTRO_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [introComplete])

  // hero score counter
  useEffect(() => {
    if (!introComplete) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) { setHeroScore(90); return }
    const duration = 1100; const start = performance.now(); let frameId
    function tick(now) {
      const t = Math.min((now - start) / duration, 1)
      setHeroScore(Math.round((1 - Math.pow(1 - t, 3)) * 90))
      if (t < 1) frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [introComplete])

  function handleHeroMove(e) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = heroRef.current?.getBoundingClientRect(); if (!rect) return
    panMouseX.set((e.clientX - rect.left - rect.width  / 2) * 0.06)
    panMouseY.set((e.clientY - rect.top  - rect.height / 2) * 0.06)
  }
  function handleHeroLeave()  { panMouseX.set(0); panMouseY.set(0) }
  function handlePanelMove(e) {
    if (window.matchMedia('(hover: none), (prefers-reduced-motion: reduce)').matches) return
    const rect = e.currentTarget.getBoundingClientRect()
    tiltX.set(-((e.clientY - rect.top  - rect.height / 2) / (rect.height / 2)) * 7)
    tiltY.set( ((e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2)) * 10)
  }
  function handlePanelLeave() { tiltX.set(0); tiltY.set(0) }
  function handleCtaMove(e) {
    const rect = ctaBtnRef.current?.getBoundingClientRect(); if (!rect) return
    ctaX.set((e.clientX - rect.left - rect.width  / 2) * 0.4)
    ctaY.set((e.clientY - rect.top  - rect.height / 2) * 0.4)
  }
  function handleCtaLeave() { ctaX.set(0); ctaY.set(0) }

  const avatarInitial = user?.name?.[0]?.toUpperCase() || 'U'

  return (
    <>
      <style>{css}</style>
      {!introComplete && (
        <div className="intro-overlay" aria-hidden="true">
          <span>PitchForge</span>
        </div>
      )}
      <div className="page">

        {/* ── NAV ── */}
        <header className="nav-shell">
          <nav className="nav">
            <Logo />
            <div className="nav-links">
              <button className="nav-link nav-link-btn" onClick={scrollToFeatures}>Features</button>
              <button className="nav-link nav-link-btn" onClick={scrollToWorkflow}>How it works</button>
              <button className="nav-link nav-link-btn" onClick={scrollToBuiltFor}>Built for</button>
              <a className="nav-link" href="https://github.com/HassanAbdullahHere/pitchforge" target="_blank" rel="noreferrer">GitHub</a>
            </div>
            <button className="nav-menu-btn" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(o => !o)}>
              <span /><span />
            </button>
            {!loading && (
              user ? (
                <div className="avatar-wrap" ref={menuRef}>
                  <button className="nav-avatar" aria-label="Open account menu" onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}>
                    <span className="avatar-initial" style={{ opacity: avatarLoaded ? 0 : 1 }}>{avatarInitial}</span>
                    {user.avatar_url && !avatarError && (
                      <img src={user.avatar_url} alt={user.name} className="avatar-img" loading="eager" fetchPriority="high"
                        style={{ opacity: avatarLoaded ? 1 : 0 }}
                        onLoad={() => setAvatarLoaded(true)} onError={() => setAvatarError(true)} />
                    )}
                  </button>
                  {(menuOpen || menuClosing) && (
                    <div className={`avatar-menu${menuClosing ? ' avatar-menu--closing' : ''}`}>
                      <div className="menu-user-info">
                        <div className="menu-avatar-lg">
                          <span className="menu-initial" style={{ opacity: avatarLoaded ? 0 : 1 }}>{avatarInitial}</span>
                          {user.avatar_url && !avatarError && (
                            <img src={user.avatar_url} alt={user.name} className="avatar-img" loading="eager" fetchPriority="high"
                              style={{ opacity: avatarLoaded ? 1 : 0 }} onLoad={() => setAvatarLoaded(true)} />
                          )}
                        </div>
                        <div className="menu-user-text">
                          <span className="menu-name">{user.name}</span>
                          <span className="menu-email">{user.email}</span>
                        </div>
                      </div>
                      {usage && (
                        <div className="usage-wrap">
                          <div className="usage-header">
                            <span className="usage-label">Daily limit</span>
                            <span className="usage-count">{Math.min(Math.round((usage.used / usage.limit) * 100), 100)}%</span>
                          </div>
                          <div className="usage-track">
                            <div className="usage-fill" style={{
                              width: `${Math.min((usage.used / usage.limit) * 100, 100)}%`,
                              background: usage.used >= usage.limit ? '#b94b44' : usage.used >= Math.ceil(usage.limit * 0.7) ? '#b98237' : '#4f7f58',
                            }} />
                          </div>
                        </div>
                      )}
                      <div className="menu-divider" />
                      {user.is_admin && <button className="menu-item" onClick={() => { closeMenu(); navigate('/admin') }}>Admin</button>}
                      <button className="menu-item" onClick={() => { closeMenu(); navigate('/profile') }}>Profile</button>
                      <button className="menu-item" onClick={() => { closeMenu(); navigate('/proposals') }}>My Proposals</button>
                      <div className="menu-divider" />
                      <button className="menu-item menu-item--danger" onClick={handleLogout}>Sign Out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button className="btn-google" onClick={() => googleLogin()}>
                  <GoogleIcon /><span>Sign in</span>
                </button>
              )
            )}
          </nav>
        </header>

        {/* ── MOBILE NAV ── */}
        {mobileNavOpen && (
          <div className="mobile-nav-overlay" onClick={() => setMobileNavOpen(false)}>
            <div className="mobile-nav-drawer" onClick={e => e.stopPropagation()}>
              <div className="mobile-nav-header">
                <Logo />
                <button className="mobile-nav-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>
                  <span /><span />
                </button>
              </div>
              <button className="mobile-nav-link" onClick={() => { setMobileNavOpen(false); scrollToFeatures() }}>Features</button>
              <button className="mobile-nav-link" onClick={() => { setMobileNavOpen(false); scrollToWorkflow() }}>How it works</button>
              <button className="mobile-nav-link" onClick={() => { setMobileNavOpen(false); scrollToBuiltFor() }}>Built for</button>
              <a className="mobile-nav-link" href="https://github.com/HassanAbdullahHere/pitchforge" target="_blank" rel="noreferrer" onClick={() => setMobileNavOpen(false)}>GitHub</a>
              {user ? (
                <>
                  {user.is_admin && (
                    <button className="mobile-nav-link" onClick={() => { setMobileNavOpen(false); navigate('/admin') }}>Admin</button>
                  )}
                  <button className="mobile-nav-link" onClick={() => { setMobileNavOpen(false); navigate('/profile') }}>Profile</button>
                  <button className="mobile-nav-link" onClick={() => { setMobileNavOpen(false); navigate('/proposals') }}>My Proposals</button>
                  <button className="btn-primary mobile-login" onClick={() => { setMobileNavOpen(false); logout() }}>
                    Sign out
                  </button>
                </>
              ) : (
                <button className="btn-primary mobile-login" onClick={() => { setMobileNavOpen(false); googleLogin() }}>
                  <GoogleIcon /><span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>
        )}

        <main>
          {/* ── HERO ── */}
          <section
            className="hero"
            ref={heroRef}
            onMouseMove={handleHeroMove}
            onMouseLeave={handleHeroLeave}
          >
            {/* Left copy */}
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 22 }}
              animate={introComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1], delay: 0.08 }}
            >
              <h1 aria-label="Land the clients your skills deserve.">
                <motion.span
                  className="hero-line"
                  initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
                  animate={introComplete ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 24, filter: 'blur(10px)' }}
                  transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.36 }}
                >
                  Land the clients
                </motion.span>
                <motion.span
                  className="hero-line grad-text"
                  initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
                  animate={introComplete ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 24, filter: 'blur(10px)' }}
                  transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.58 }}
                >
                  your skills deserve.
                </motion.span>
              </h1>

              <motion.div className="hero-actions"
                initial={{ opacity: 0, y: 14 }} animate={introComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay: 0.84 }}
              >
                <button className="btn-primary btn-lg" onClick={handleGetStarted}>Analyze a job</button>
                <button className="btn-secondary btn-lg" onClick={scrollToWorkflow}>See workflow</button>
              </motion.div>

              {false && (
              <motion.div className="hero-chips" aria-label="Key capabilities"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.0 }}
              >
                {[
                  { icon: '◈', label: 'AI-scored fit' },
                  { icon: '◉', label: 'Profile-grounded' },
                  { icon: '◎', label: 'Human-approved' },
                ].map(chip => (
                  <span key={chip.label} className="hero-chip">
                    <span className="chip-icon" aria-hidden="true">{chip.icon}</span>
                    {chip.label}
                  </span>
                ))}
              </motion.div>
              )}
            </motion.div>

            {/* Right — 2.5D stack */}
            <motion.div
              className="stack-scene"
              aria-label="Product preview"
              initial={{ opacity: 0, y: 40 }}
              animate={introComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.22 }}
            >
              {/* Back card */}
              <motion.div className="stack-back" style={{ x: backX, y: backY }}>
                <span className="column-label">Job signal</span>
                <p className="stack-back-text">
                  Looking for a senior React Native developer to build an AI-powered internal assistant.
                  Needs retrieval, evaluation pipeline, admin upload, and a working prototype shipped this month.
                </p>
                <div className="stack-back-tags">
                  <span>RAG</span><span>FastAPI</span><span>React Native</span>
                </div>
              </motion.div>

              {/* Mid card — main analysis panel */}
              <div className="stack-mid-wrap">
                <motion.div
                  className="analysis-panel"
                  style={{ x: midX, y: midY, rotateX: tiltX, rotateY: tiltY }}
                  onMouseMove={handlePanelMove}
                  onMouseLeave={handlePanelLeave}
                >
                  <div className="panel-top">
                    <div>
                      <span className="panel-kicker">Analysis complete</span>
                      <h2>Job Fit Report</h2>
                    </div>
                    <div className="score-block">
                      <strong>{heroScore}</strong><span>/100</span>
                    </div>
                  </div>
                  <div className="meter" aria-hidden="true">
                    <span style={{ '--score': `${heroScore}%` }} />
                  </div>
                  <div className="signal-list">
                    {SIGNALS.map(s => (
                      <div className="signal-row" key={s.label}>
                        <span>{s.label}</span><strong>{s.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="draft-preview">
                    <div className="draft-header">
                      <span>Recommendation</span><span>Strong apply</span>
                    </div>
                    <p>The job aligns strongly with your mobile delivery profile. Lead with shipped React Native work, App Store experience, and a clear release plan.</p>
                  </div>
                </motion.div>
              </div>

              {/* Front floating badges */}
              <motion.div className="float-badge badge-fit"   style={{ x: frontX, y: frontY }}>
                <span>Fit</span><strong>{heroScore}</strong>
              </motion.div>
              <motion.div className="float-badge badge-rate"  style={{ x: frontX, y: frontY }}>
                $70&nbsp;/&nbsp;hr
              </motion.div>
              <motion.div className="float-badge badge-draft" style={{ x: frontX, y: frontY }}>
                Draft ready ✓
              </motion.div>
            </motion.div>
          </section>

          {/* ── DECISION ── */}
          <section className="platform-strip" aria-label="Freelance platforms">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55 }}
            >
              Built for proposal workflows across modern freelance platforms
            </motion.p>
            <div className="platform-rail">
              <div className="platform-track">
                {PLATFORM_LOGOS.map(name => (
                  <span className="platform-logo" key={name}>{name}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="decision-section" ref={featuresRef}>
            <motion.div className="section-heading"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}
            >
              <span className="section-kicker">Decision layer</span>
              <h2>Apply with judgment, not guesswork.</h2>
              <p>Premium proposal work starts before the draft. PitchForge shows whether the job deserves your time and what argument you should lead with.</p>
            </motion.div>
            <div className="decision-grid">
              {DECISION_POINTS.map((point, i) => (
                <TiltCard key={point.label} className="decision-card" delay={i * 0.12}>
                  <h3>{point.label}</h3>
                  <p>{point.body}</p>
                </TiltCard>
              ))}
            </div>
          </section>

          {/* ── PRODUCT: sticky scroll scenes ── */}
          <section className="process-section" id="workflow" ref={workflowRef}>
            <motion.div
              className="section-heading process-heading"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.65 }}
            >
              <span className="section-kicker">How it works</span>
              <h2>Four quiet steps from job post to proposal.</h2>
              <p>Each step narrows the decision so the final draft feels specific, defensible, and worth sending.</p>
            </motion.div>
            <div className="process-cards">
              {WORKFLOW_DETAILS.map(({ step, body }, i) => (
                <motion.article
                  className="process-card"
                  key={step}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                >
                  <span className="process-num">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{step}</h3>
                  <p>{body}</p>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="product-section" ref={productTrackRef}>
            <div className="product-scene-sticky">
              <div className="scene-eyebrow">
                <span className="section-kicker">How it works</span>
              </div>

              {/* Scene 1 */}
              <motion.div className="product-scene" style={{ opacity: s1Op, y: s1Y }}>
                <div className="scene-label">
                  <span className="scene-num">01</span>Paste the job post
                </div>
                <div className="product-frame-single">
                  <span className="column-label">Job signal</span>
                  <h3 className="scene-title">AI assistant for internal support docs</h3>
                  <p className="scene-body">Needs retrieval, evaluation, admin upload flow, and a working prototype this month.</p>
                  <div className="compact-tags">
                    <span>RAG</span><span>FastAPI</span><span>Evaluation</span>
                  </div>
                  <div className="scene-divider" />
                  <p className="scene-hint">PitchForge extracts scope, skills, budget clues, and delivery risk from the posting.</p>
                </div>
              </motion.div>

              {/* Scene 2 */}
              <motion.div className="product-scene" style={{ opacity: s2Op, y: s2Y }}>
                <div className="scene-label">
                  <span className="scene-num">02</span>Get scored instantly
                </div>
                <div className="product-frame-single">
                  <div className="scene-score-row">
                    <div>
                      <span className="column-label">Positioning</span>
                      <div className="position-score">
                        <strong>82</strong><span>Strong apply</span>
                      </div>
                    </div>
                    <div className="scene-skill-list">
                      {['Lead with shipped retrieval systems', 'Mention measurable answer quality', 'Clarify budget before full build'].map((s, i) => (
                        <div key={i} className={`skill-chip${i === 2 ? ' skill-chip--gap' : ''}`}>
                          <span className="skill-dot" />{s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="scene-divider" />
                  <p className="scene-hint">Your fit score tells you whether the opportunity is worth the time before writing a word.</p>
                </div>
              </motion.div>

              {/* Scene 3 */}
              <motion.div className="product-scene" style={{ opacity: s3Op, y: s3Y }}>
                <div className="scene-label">
                  <span className="scene-num">03</span>Receive a positioned draft
                </div>
                <div className="product-frame-single draft-scene">
                  <span className="column-label">Proposal draft</span>
                  {DRAFT_LINES.map((line, i) => (
                    <motion.p key={i} className="scene-draft-line"
                      initial={{ opacity: 0, x: -14 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: false }}
                      transition={{ duration: 0.45, delay: i * 0.16 }}
                    >
                      {line}
                    </motion.p>
                  ))}
                  <div className="scene-divider" />
                  <p className="scene-hint">Grounded in your shipped work — not generic AI filler.</p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ── WORKFLOW ── */}
          <section className="workflow-section">
            <motion.div className="section-heading"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
            >
              <span className="section-kicker">Workflow</span>
              <h2>From raw job post to a proposal you can defend.</h2>
              <p>Every step narrows the work: first decide if the opportunity is worth it, then draft from evidence.</p>
            </motion.div>
            <div className="workflow-grid">
              <motion.div
                className="workflow-line"
                initial={{ scaleX: 0 }}
                animate={isWorkflowInView ? { scaleX: 1 } : {}}
                transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
              />
              {WORKFLOW_DETAILS.map(({ step, body }, i) => (
                <motion.div
                  key={step}
                  className="workflow-card"
                  initial={{ opacity: 0, scale: 0.72, y: 22 }}
                  animate={isWorkflowInView ? { opacity: 1, scale: 1, y: 0 } : {}}
                  transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.35 + i * 0.14 }}
                  whileHover={{ y: -3 }}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <h3>{step}</h3>
                  <p>{body}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── AUDIENCE ── */}
          <section className="audience-section" ref={builtForRef}>
            <motion.div
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
            >
              <span className="section-kicker">Built for</span>
              <h2>People who win work with proof, not volume.</h2>
              <p className="audience-copy">PitchForge is for technical sellers who need better judgment before they write more proposals.</p>
            </motion.div>
            <div className="audience-list">
              {AUDIENCES.map((item, i) => {
                const init = i === 0 ? { x: -65, opacity: 0 } : i === 1 ? { y: 40, scale: 0.95, opacity: 0 } : { x: 65, opacity: 0 }
                return (
                  <motion.article
                    key={item.label}
                    className="audience-card"
                    initial={init}
                    whileInView={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    whileHover={{ x: 4 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ type: 'spring', damping: 20, stiffness: 90, delay: i * 0.1 }}
                  >
                    <span>{item.label}</span>
                    <p>{item.body}</p>
                  </motion.article>
                )
              })}
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="final-cta-wrap" ref={pricingRef}>
            <motion.div
              className="final-cta"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
            >
              <h2>Start with your next job post.</h2>
              <p>Know the fit, choose the angle, and draft from your actual experience.</p>
              <motion.button
                ref={ctaBtnRef}
                className="btn-primary btn-lg"
                style={{ x: ctaX, y: ctaY }}
                onMouseMove={handleCtaMove}
                onMouseLeave={handleCtaLeave}
                onClick={handleGetStarted}
              >
                Analyze a job
              </motion.button>
            </motion.div>
          </section>
        </main>
      </div>

      {loginError && (
        <div className="login-error-toast" onClick={() => setLoginError(null)}>
          {loginError}
        </div>
      )}
    </>
  )
}

const css = `
  :root {
    --font:         'Instrument Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    --ink:          #f4f2f0;
    --muted:        rgba(244,242,240,0.62);
    --faint:        rgba(244,242,240,0.38);
    --line:         rgba(244,242,240,0.10);
    --panel:        #111120;
    --panel-strong: #161626;
    --wash:         #0a0a14;
    --accent:       #7B6BE3;
    --accent-soft:  rgba(123,107,227,0.13);
    --dark:         #eef0f5;
    --shadow:       0 28px 90px rgba(0,0,0,0.52), 0 2px 14px rgba(0,0,0,0.36);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-width: 320px;
    background:
      radial-gradient(circle at 50% -12%, rgba(100,78,230,0.14), transparent 38%),
      radial-gradient(circle at 88% 18%,  rgba(244,242,240,0.04), transparent 30%),
      linear-gradient(180deg, #0d0d18 0%, #0a0a14 46%, #070710 100%);
    color: var(--ink);
    font-family: var(--font);
  }

  /* ── gradient text ─────────────────────────────────────────────── */
  @keyframes gradShift {
    0%,100% { background-position: 0% 50%; }
    50%     { background-position: 100% 50%; }
  }
  .grad-text {
    background: linear-gradient(90deg, #9b8ee8, #c9a84c, #7B6BE3, #c9a84c, #9b8ee8);
    background-size: 300% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradShift 4s ease-in-out infinite;
  }

  /* ── layout ─────────────────────────────────────────────────────── */
  button, a { font-family: var(--font); }
  button { touch-action: manipulation; }

  .page {
    min-height: 100vh;
    min-height: 100dvh;
    position: relative;
    overflow-x: hidden;
  }

  .page::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image:
      linear-gradient(rgba(244,241,232,0.044) 1px, transparent 1px),
      linear-gradient(90deg, rgba(244,241,232,0.044) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 58%);
  }

  .page > * { position: relative; z-index: 1; }

  .intro-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 50% 42%, rgba(123,107,227,0.16), transparent 34%),
      #070710;
    pointer-events: none;
    animation: introLeave 2.45s cubic-bezier(.2,.8,.2,1) forwards;
  }
  .intro-overlay span {
    display: block;
    color: var(--ink);
    font-size: clamp(3rem, 11vw, 9.8rem);
    font-weight: 760;
    line-height: 0.9;
    letter-spacing: 0;
    opacity: 0;
    transform: translateY(22px) scale(0.96);
    animation: introWord 2.15s cubic-bezier(.2,.8,.2,1) forwards;
  }
  .intro-mark {
    display: flex;
    align-items: center;
    gap: 18px;
    opacity: 0;
    transform: translateY(22px) scale(0.96);
    animation: introWord 2.15s cubic-bezier(.2,.8,.2,1) forwards;
  }
  .intro-mark span {
    opacity: 1;
    transform: none;
    animation: none;
  }
  .intro-mark svg {
    width: clamp(42px, 6vw, 72px);
    height: clamp(42px, 6vw, 72px);
    border-radius: 18px;
    box-shadow: 0 18px 60px rgba(0,0,0,0.34);
    flex-shrink: 0;
  }
  @keyframes introWord {
    0% { opacity: 0; transform: translateY(24px) scale(0.96); filter: blur(14px); }
    24%, 58% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    100% { opacity: 0; transform: translateY(-42px) scale(1.04); filter: blur(10px); }
  }
  @keyframes introLeave {
    0%, 72% { opacity: 1; visibility: visible; }
    100% { opacity: 0; visibility: hidden; }
  }

  /* ── nav ─────────────────────────────────────────────────────────── */
  .nav-shell { position: sticky; top: 16px; z-index: 100; padding: 0 24px; }

  .nav {
    width: min(1160px, 100%);
    margin: 0 auto;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 9px 12px 9px 18px;
    border: 1px solid rgba(244,242,240,0.10);
    border-radius: 999px;
    background: rgba(12,12,22,0.82);
    box-shadow: 0 18px 60px rgba(0,0,0,0.36);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .nav-links { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 26px; }

  .nav-link {
    border: 0; background: none;
    color: rgba(244,241,232,0.58);
    cursor: pointer; font-size: 14px; font-weight: 500;
    text-decoration: none;
    transition: color 160ms ease;
  }
  .nav-link:hover { color: var(--ink); }

  .nav-menu-btn {
    display: none; width: 38px; height: 38px;
    border: 0; border-radius: 10px;
    background: rgba(244,241,232,0.07);
    cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px;
  }
  .nav-menu-btn span, .mobile-nav-close span {
    width: 17px; height: 2px; border-radius: 999px; background: rgba(244,241,232,0.74);
  }

  /* ── buttons ─────────────────────────────────────────────────────── */
  .btn-google, .btn-primary, .btn-secondary {
    border: 0; cursor: pointer; font-weight: 600; letter-spacing: 0;
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }
  .btn-primary {
    background: var(--dark); color: #11150f; border-radius: 12px;
    padding: 12px 20px; box-shadow: 0 14px 34px rgba(0,0,0,0.28);
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 18px 42px rgba(0,0,0,0.34); }
  .btn-primary:active { transform: translateY(0); }
  .btn-secondary {
    background: rgba(244,241,232,0.05); color: var(--ink);
    border: 1px solid var(--line); border-radius: 12px; padding: 12px 20px;
  }
  .btn-secondary:hover { background: rgba(244,241,232,0.10); }
  .btn-lg { min-height: 48px; padding-inline: 22px; font-size: 15px; }
  .btn-google {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--dark); color: #11150f; border-radius: 999px; padding: 10px 17px; font-size: 13px;
  }
  .google-icon { width: 16px; height: 16px; flex: 0 0 16px; display: block; }

  /* ── avatar / menu ─────────────────────────────────────────────── */
  .avatar-wrap { position: relative; flex-shrink: 0; }
  .nav-avatar {
    position: relative; width: 42px; height: 42px;
    border: 1px solid rgba(244,241,232,0.16); border-radius: 50%;
    background: #09090a; overflow: hidden; cursor: pointer;
  }
  .avatar-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: opacity 150ms ease; }
  .avatar-initial, .menu-initial { color: #fffdf6; font-size: 15px; font-weight: 700; line-height: 1; transition: opacity 150ms ease; }
  .avatar-menu {
    position: absolute; top: calc(100% + 10px); right: 0; width: 258px;
    padding: 8px; border: 1px solid var(--line); border-radius: 16px;
    background: rgba(14,14,26,0.97); box-shadow: var(--shadow);
    animation: menuIn 160ms ease both;
  }
  @keyframes menuIn  { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes menuOut { from { opacity: 1; transform: translateY(0); }    to { opacity: 0; transform: translateY(-5px); } }
  .avatar-menu--closing { animation: menuOut 140ms ease forwards; pointer-events: none; }
  .menu-user-info { display: flex; align-items: center; gap: 11px; padding: 10px; }
  .menu-avatar-lg {
    position: relative; width: 38px; height: 38px; border-radius: 50%;
    background: #09090a; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .menu-user-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .menu-name  { color: var(--ink); font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .menu-email { color: var(--faint); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .menu-divider { height: 1px; background: var(--line); margin: 5px 0; }
  .menu-item {
    width: 100%; border: 0; border-radius: 10px; background: transparent;
    color: rgba(244,241,232,0.74); cursor: pointer; font-size: 14px; font-weight: 500;
    padding: 10px 12px; text-align: left;
  }
  .menu-item:hover { background: rgba(244,241,232,0.07); color: var(--ink); }
  .menu-item--danger { color: #e89b94; }
  .usage-wrap { padding: 8px 10px 12px; }
  .usage-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
  .usage-label, .usage-count { color: var(--faint); font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .usage-track { height: 4px; overflow: hidden; background: rgba(244,241,232,0.10); border-radius: 999px; }
  .usage-fill  { height: 100%; border-radius: inherit; }

  /* ── hero ────────────────────────────────────────────────────────── */
  .hero {
    width: min(1160px, calc(100% - 40px));
    min-height: auto;
    margin: 0 auto;
    padding: 126px 0 38px;
    display: grid;
    grid-template-columns: 1fr;
    align-items: start;
    justify-items: stretch;
    gap: 28px;
  }
  .hero-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
    width: min(900px, 100%);
    justify-self: center;
    padding-top: 16px;
  }

  .eyebrow-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px 6px 10px; border-radius: 100px;
    border: 1px solid rgba(123,107,227,0.28);
    background: rgba(123,107,227,0.10);
    color: rgba(244,242,240,0.72); font-size: 12px; font-weight: 600;
    letter-spacing: 0.03em;
    backdrop-filter: blur(8px);
  }
  .badge-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    background: #7B6BE3;
    box-shadow: 0 0 8px rgba(123,107,227,0.7);
    animation: pulseDot 2.8s ease-in-out infinite;
  }
  .hero-chips { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 4px; }
  .hero-chip  {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 12px; border-radius: 100px;
    border: 1px solid rgba(244,242,240,0.10);
    background: rgba(244,242,240,0.05);
    color: rgba(244,242,240,0.56); font-size: 13px; font-weight: 500;
  }
  .chip-icon { color: rgba(123,107,227,0.8); font-size: 11px; }
  .section-kicker, .panel-kicker, .column-label {
    color: rgba(244,242,240,0.44); font-size: 12px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .hero h1 {
    max-width: 720px; margin: 0; color: var(--ink);
    font-size: clamp(2.55rem, 4.9vw, 4.35rem); line-height: 1; letter-spacing: 0;
  }
  .hero-line { display: block; }
  .hero-sub  { max-width: 540px; margin: 0; color: var(--muted); font-size: 17px; line-height: 1.65; }
  .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; width: 100%; margin-top: 18px; }
  .hero .stack-scene { width: min(900px, 100%); justify-self: center; }

  .platform-strip {
    width: min(1160px, calc(100% - 40px));
    margin: 0 auto;
    min-height: auto;
    padding: 30px 0 22px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .platform-strip p {
    margin: 0 0 14px;
    color: rgba(244,242,240,0.38);
    font-size: 14px;
    text-align: center;
  }
  .platform-rail {
    position: relative;
    overflow: hidden;
    border-block: 1px solid rgba(244,242,240,0.08);
  }
  .platform-track {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: clamp(28px, 5.5vw, 68px);
    padding: 18px 0;
    flex-wrap: wrap;
  }
  .platform-logo {
    color: rgba(244,242,240,0.62);
    font-size: clamp(19px, 2.1vw, 26px);
    font-weight: 720;
    letter-spacing: 0;
    white-space: nowrap;
    filter: grayscale(1);
  }

  /* ── 2.5D stack ──────────────────────────────────────────────────── */
  .stack-scene {
    position: relative;
    padding: 36px 20px 36px 0;
    /* allow badges to overflow */
    overflow: visible;
  }

  /* back card — slightly behind and blurred */
  .stack-back {
    position: absolute;
    inset: 10px -6px auto 14px;
    padding: 18px 20px;
    border: 1px solid rgba(244,241,232,0.065);
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(14,14,28,0.72), rgba(7,7,16,0.78));
    filter: blur(1.5px);
    opacity: 0.46;
    transform: scale(0.95);
    transform-origin: center top;
    z-index: 0;
    pointer-events: none;
  }
  .stack-back-text { margin: 10px 0 0; color: rgba(244,241,232,0.44); font-size: 13px; line-height: 1.6; }
  .stack-back-tags { display: flex; gap: 7px; margin-top: 12px; flex-wrap: wrap; }
  .stack-back-tags span {
    border: 1px solid rgba(244,241,232,0.10); border-radius: 999px;
    background: rgba(244,241,232,0.04); color: rgba(244,241,232,0.42);
    font-size: 11px; font-weight: 700; padding: 5px 9px;
  }

  /* mid card wrapper — above back card */
  .stack-mid-wrap {
    position: relative;
    z-index: 2;
    perspective: 1000px;
    margin-top: 18px;
  }

  /* analysis panel (shared with existing) */
  .analysis-panel {
    border: 1px solid rgba(244,241,232,0.13);
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(18,18,32,0.96), rgba(10,10,22,0.98));
    box-shadow: var(--shadow);
    padding: 28px;
    will-change: transform;
    cursor: default;
  }
  .panel-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
  .panel-top h2 { margin: 7px 0 0; font-size: 27px; line-height: 1.15; letter-spacing: 0; }
  .score-block {
    min-width: 128px; padding: 14px; border-radius: 16px;
    background: rgba(238,240,229,0.95); color: #11150f; text-align: right;
  }
  .score-block strong { display: inline; font-size: 46px; line-height: 0.95; }
  .score-block span   { color: rgba(17,17,28,0.50); font-size: 16px; font-weight: 700; margin-left: 2px; }
  .meter { height: 8px; margin: 22px 0; border-radius: 999px; background: rgba(244,241,232,0.10); overflow: hidden; }
  .meter span {
    display: block; height: 100%; width: var(--score, 0%); border-radius: inherit;
    background: linear-gradient(90deg, #6658c8, #9b8ee8);
    transition: width 900ms cubic-bezier(.2,.8,.2,1);
  }
  .signal-list { display: grid; gap: 10px; }
  .signal-row { display: grid; grid-template-columns: 116px minmax(0,1fr); gap: 14px; padding: 13px 0; border-top: 1px solid var(--line); }
  .signal-row span   { color: var(--faint); font-size: 13px; font-weight: 700; }
  .signal-row strong { color: rgba(244,241,232,0.84); font-size: 15px; line-height: 1.35; text-align: right; }
  .draft-preview { margin-top: 14px; padding: 16px; border: 1px solid rgba(123,107,227,0.20); border-radius: 16px; background: rgba(123,107,227,0.09); }
  .draft-header { display: flex; justify-content: space-between; gap: 12px; color: rgba(244,241,232,0.46); font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; }
  .draft-preview p { margin: 0; color: rgba(244,241,232,0.78); font-size: 14px; line-height: 1.65; }

  /* ── floating badges ────────────────────────────────────────────── */
  .float-badge {
    display: none;
    position: absolute;
    padding: 9px 14px;
    border-radius: 12px;
    background: rgba(14,14,28,0.94);
    border: 1px solid rgba(244,241,232,0.17);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 8px 28px rgba(0,0,0,0.38), inset 0 1px 0 rgba(244,241,232,0.07);
    font-size: 12px; font-weight: 700; white-space: nowrap;
    z-index: 4; color: rgba(244,241,232,0.9);
    align-items: center; gap: 7px;
    pointer-events: none;
  }
  .badge-fit  { top: 4px; right: -10px; color: #adbca3; }
  .badge-fit span   { color: var(--faint); font-weight: 600; font-size: 11px; }
  .badge-fit strong { font-size: 16px; color: var(--accent); }
  .badge-rate  { right: -18px; top: 44%; color: #c9a84c; }
  .badge-draft { bottom: 30px; left: -10px; color: #adbca3; }

  /* ── sections shared ─────────────────────────────────────────────── */
  .decision-section,
  .workflow-section,
  .audience-section,
  .process-section {
    width: min(1160px, calc(100% - 40px));
    margin: 0 auto;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 56px 0;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .decision-section::before,
  .workflow-section::before,
  .audience-section::before,
  .process-section::before {
    content: ''; position: absolute; left: 50%; top: 0; width: 100vw; height: 100%;
    transform: translateX(-50%); pointer-events: none; z-index: -1;
  }
  .decision-section::before {
    background:
      radial-gradient(ellipse 62% 42% at 50% 14%, rgba(244,242,240,0.022), transparent 70%),
      linear-gradient(180deg, rgba(4,4,10,0), rgba(4,4,10,0.18) 55%, rgba(4,4,10,0));
  }
  .decision-section {
    min-height: auto;
    margin-top: 72px;
    margin-bottom: 72px;
    padding-top: 56px;
    padding-bottom: 56px;
    justify-content: flex-start;
  }
  .workflow-section::before {
    background:
      radial-gradient(ellipse 58% 44% at 50% 50%, rgba(100,85,220,0.05), transparent 70%),
      linear-gradient(180deg, rgba(4,4,10,0.12), rgba(4,4,10,0.24), rgba(4,4,10,0.12));
  }
  .process-section::before {
    background:
      radial-gradient(ellipse 58% 44% at 50% 38%, rgba(123,107,227,0.055), transparent 70%),
      linear-gradient(180deg, rgba(4,4,10,0.04), rgba(4,4,10,0.18), rgba(4,4,10,0.04));
  }
  .audience-section::before {
    background:
      radial-gradient(ellipse 70% 44% at 68% 50%, rgba(244,242,240,0.022), transparent 72%),
      linear-gradient(180deg, rgba(4,4,10,0), rgba(4,4,10,0.16) 50%, rgba(4,4,10,0));
  }

  .section-heading { max-width: 720px; display: flex; flex-direction: column; gap: 13px; margin-bottom: 34px; }
  .section-heading h2, .audience-section h2, .final-cta h2 {
    margin: 0; color: var(--ink); font-size: clamp(2rem, 4vw, 3.15rem); line-height: 1.02; letter-spacing: 0;
  }
  .section-heading p, .final-cta p { margin: 0; color: var(--muted); font-size: 16px; line-height: 1.65; }

  .process-section {
    min-height: auto;
    padding: 96px 0;
    display: grid;
    grid-template-columns: minmax(260px, 0.75fr) minmax(0, 1.25fr);
    gap: 44px;
    align-items: start;
  }
  .process-heading {
    position: static;
    width: auto;
    margin: 0;
    text-align: left;
    align-items: flex-start;
    padding-top: 0;
    pointer-events: auto;
  }
  .process-cards {
    width: 100%;
    height: auto;
    position: static;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .process-card {
    position: relative;
    width: 100%;
    min-height: 230px;
    border: 1px solid rgba(244,241,232,0.12);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(244,241,232,0.085), rgba(244,241,232,0.03)),
      rgba(11,11,22,0.96);
    box-shadow: 0 18px 60px rgba(0,0,0,0.26);
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 16px;
  }
  .process-num {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: 1px solid rgba(244,241,232,0.12);
    color: rgba(244,242,240,0.46);
    font-size: 12px;
    font-weight: 760;
  }
  .process-card h3 {
    margin: 18px 0 0;
    color: var(--ink);
    font-size: 22px;
    line-height: 1.15;
  }
  .process-card p {
    margin: 0;
    color: rgba(244,242,240,0.58);
    font-size: 14px;
    line-height: 1.62;
  }

  .product-section,
  .workflow-section {
    display: none;
  }

  /* ── decision cards ─────────────────────────────────────────────── */
  .decision-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .decision-card {
    border: 1px solid rgba(244,241,232,0.15); border-radius: 16px;
    background: rgba(10,14,10,0.28); padding: 24px;
    transition: background 200ms ease, border-color 200ms ease;
    cursor: default;
  }
  .decision-card:hover { background: rgba(244,241,232,0.065); border-color: rgba(244,241,232,0.22); }
  .decision-card h3 { margin: 0 0 11px; font-size: 17px; }
  .decision-card p  { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }

  /* ── product sticky scroll ──────────────────────────────────────── */
  .product-section {
    height: 280vh;
    position: relative;
    border-block: 1px solid rgba(244,241,232,0.10);
    background:
      radial-gradient(ellipse 70% 90% at 50% 50%, rgba(100,85,220,0.04), transparent 70%),
      rgba(4,4,10,0.22);
  }
  .product-scene-sticky {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .scene-eyebrow {
    position: absolute;
    top: 44px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    pointer-events: none;
  }
  .product-scene {
    position: absolute;
    width: min(860px, calc(100% - 40px));
    will-change: opacity, transform;
  }
  .scene-label {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 20px;
    color: rgba(244,241,232,0.52); font-size: 14px; font-weight: 700;
  }
  .scene-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 8px;
    border: 1px solid rgba(244,241,232,0.16);
    background: rgba(244,241,232,0.06);
    color: rgba(244,241,232,0.48); font-size: 11px; font-weight: 800;
    flex-shrink: 0;
  }
  .product-frame-single {
    border: 1px solid rgba(244,241,232,0.14); border-radius: 22px;
    background: rgba(12,12,24,0.88); box-shadow: 0 26px 90px rgba(0,0,0,0.42);
    padding: 32px;
  }
  .scene-title { margin: 16px 0 10px; font-size: 24px; line-height: 1.15; }
  .scene-body  { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.65; }
  .compact-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }
  .compact-tags span {
    border: 1px solid rgba(244,241,232,0.15); border-radius: 999px;
    background: rgba(244,241,232,0.065); color: rgba(244,241,232,0.68);
    font-size: 13px; font-weight: 700; padding: 8px 11px;
  }
  .scene-divider { height: 1px; background: var(--line); margin: 24px 0; }
  .scene-hint { margin: 0; color: rgba(244,241,232,0.4); font-size: 13px; line-height: 1.6; font-style: italic; }

  /* scene 2 */
  .scene-score-row { display: grid; grid-template-columns: auto 1fr; gap: 32px; align-items: start; }
  .position-score  { margin: 14px 0; display: flex; align-items: baseline; gap: 12px; }
  .position-score strong { font-size: 56px; line-height: 0.9; }
  .position-score span   { color: var(--accent); font-size: 14px; font-weight: 800; }
  .scene-skill-list { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
  .skill-chip {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 10px;
    border: 1px solid rgba(123,107,227,0.22);
    background: rgba(123,107,227,0.07);
    color: rgba(244,241,232,0.76); font-size: 14px;
  }
  .skill-chip--gap { border-color: rgba(201,168,76,0.18); background: rgba(201,168,76,0.06); }
  .skill-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--accent); }
  .skill-chip--gap .skill-dot { background: #c9a84c; }

  /* scene 3 */
  .draft-scene .column-label { margin-bottom: 4px; display: block; }
  .scene-draft-line { margin: 16px 0 0; color: rgba(255,253,246,0.82); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,253,246,0.1); padding-top: 16px; }
  .scene-draft-line:first-of-type { border-top: 0; padding-top: 12px; }

  /* ── workflow ────────────────────────────────────────────────────── */
  .workflow-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0,1fr));
    gap: 12px;
    position: relative;
  }
  .workflow-line {
    position: absolute;
    left: 8%; right: 8%; top: 33px; height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    transform-origin: left center;
    z-index: 0;
    pointer-events: none;
  }
  .workflow-card {
    min-height: 218px;
    border: 1px solid var(--line); border-radius: 16px;
    background: linear-gradient(180deg, rgba(244,241,232,0.068), rgba(5,8,6,0.24));
    padding: 18px; position: relative; overflow: hidden; cursor: default;
    transition: border-color 180ms ease, background 180ms ease;
  }
  .workflow-card::before {
    content: ''; width: 10px; height: 10px; border-radius: 50%;
    position: absolute; top: 27px; right: 18px;
    background: var(--accent); box-shadow: 0 0 0 6px rgba(123,107,227,0.12);
    animation: pulseDot 2.8s ease-in-out infinite;
  }
  @keyframes pulseDot {
    0%,100% { opacity: 0.72; transform: scale(1); }
    50%     { opacity: 1;    transform: scale(1.16); }
  }
  .workflow-card:hover { border-color: rgba(244,241,232,0.18); background: rgba(244,241,232,0.075); }
  .workflow-card span { color: var(--faint); font-size: 12px; font-weight: 800; }
  .workflow-card h3   { margin: 42px 0 12px; font-size: 18px; }
  .workflow-card p    { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; }

  /* ── audience ────────────────────────────────────────────────────── */
  .audience-section { display: grid; grid-template-columns: minmax(0, 0.78fr) minmax(420px, 1fr); gap: 50px; align-items: center; }
  .audience-section { min-height: auto; padding-top: 48px; padding-bottom: 48px; }
  .audience-copy { margin: 16px 0 0; color: var(--muted); font-size: 16px; line-height: 1.65; max-width: 520px; }
  .audience-list { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .audience-card {
    border: 1px solid rgba(244,241,232,0.15); border-radius: 16px;
    background: rgba(10,14,10,0.30); padding: 18px 20px;
    transition: background 180ms ease, border-color 180ms ease;
    cursor: default;
  }
  .audience-card:hover { background: rgba(244,241,232,0.075); border-color: rgba(244,241,232,0.17); }
  .audience-card span { color: var(--ink); font-size: 15px; font-weight: 800; }
  .audience-card p    { margin: 8px 0 0; color: var(--muted); font-size: 14px; line-height: 1.58; }

  /* ── CTA ─────────────────────────────────────────────────────────── */
  .final-cta-wrap {
    width: min(1160px, calc(100% - 40px));
    margin: 0 auto 56px;
    padding: 88px 0 0;
  }
  .final-cta {
    padding: 58px;
    border-radius: 24px;
    background: linear-gradient(135deg, rgba(30,30,31,0.94), rgba(15,15,16,0.96));
    display: flex; flex-direction: column; align-items: flex-start; gap: 18px;
    box-shadow: var(--shadow), 0 0 0 1px rgba(123,107,227,0.20);
    position: relative;
  }
  .final-cta::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 0 1px rgba(201,168,76,0.40), 0 0 70px rgba(201,168,76,0.07);
    opacity: 0;
    animation: ctaGlowPulse 5s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes ctaGlowPulse {
    0%,100% { opacity: 0; }
    50%     { opacity: 1; }
  }

  /* ── mobile nav ──────────────────────────────────────────────────── */
  .mobile-nav-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.54); }
  .mobile-nav-drawer  { position: fixed; inset: 0 0 auto; padding: 18px 20px 24px; border-bottom: 1px solid var(--line); background: rgba(12,12,24,0.98); box-shadow: var(--shadow); }
  .mobile-nav-header  { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
  .mobile-nav-close   { width: 38px; height: 38px; border: 0; border-radius: 10px; background: rgba(244,241,232,0.08); display: flex; align-items: center; justify-content: center; position: relative; }
  .mobile-nav-close span { position: absolute; }
  .mobile-nav-close span:first-child { transform: rotate(45deg); }
  .mobile-nav-close span:last-child  { transform: rotate(-45deg); }
  .mobile-nav-link {
    display: block; width: 100%; padding: 14px 2px;
    border: 0; border-top: 1px solid var(--line);
    background: transparent; color: var(--ink); cursor: pointer;
    font-size: 17px; font-weight: 700; text-align: left; text-decoration: none;
  }
  .mobile-login { margin-top: 18px; width: 100%; }

  /* ── toast ───────────────────────────────────────────────────────── */
  .login-error-toast {
    position: fixed; left: 0; right: 0; bottom: 26px;
    margin: 0 auto; width: fit-content;
    max-width: calc(100% - 32px); z-index: 500;
    border: 1px solid rgba(153,66,61,0.28); border-radius: 12px;
    background: #2a1715; color: #f3d7d2;
    box-shadow: var(--shadow); padding: 13px 18px;
    font-size: 13px; font-weight: 700; cursor: pointer;
  }

  /* ── responsive ──────────────────────────────────────────────────── */
  @media (max-width: 980px) {
    .hero { grid-template-columns: 1fr; gap: 30px; padding-top: 72px; }
    .stack-scene { padding: 20px 0; }
    .stack-back { inset: 8px 0 auto 10px; }
    .badge-rate { right: -10px; }
    .decision-grid { grid-template-columns: 1fr; }
    .process-section {
      min-height: auto;
      display: block;
      padding: 48px 0;
    }
    .process-heading { position: static; width: 100%; padding-top: 0; pointer-events: auto; }
    .process-cards {
      min-height: auto;
      width: 100%;
      height: auto;
      position: relative;
      top: auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      margin-top: 32px;
    }
    .process-card {
      position: relative;
      top: auto;
      left: auto;
      right: auto;
      inset: auto;
      min-height: 260px;
      transform: none;
      margin-top: 0;
    }
    .workflow-grid { grid-template-columns: repeat(2, 1fr); }
    .workflow-line { display: none; }
    .audience-section { grid-template-columns: 1fr; gap: 24px; }
    /* product: disable sticky on mobile */
    .product-section { height: auto; padding: 40px 0; }
    .product-scene-sticky { position: static; height: auto; display: block; padding: 0 20px; }
    .product-scene { position: static; opacity: 1 !important; transform: none !important; margin-bottom: 32px; }
    .product-scene:last-child { margin-bottom: 0; }
    .scene-eyebrow { position: static; transform: none; text-align: left; margin-bottom: 20px; }
    .scene-score-row { grid-template-columns: 1fr; gap: 16px; }
  }

  @media (max-width: 720px) {
    .nav-shell { top: 10px; padding: 0 12px; pointer-events: auto; }
    .nav {
      border-radius: 18px;
      padding: 9px 10px 9px 14px;
      pointer-events: auto;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      background: rgba(12,12,22,0.97);
    }
    .nav-links,
    .nav-menu-btn { display: none; }
    .nav > .btn-google { display: inline-flex; padding: 10px 14px; }
    .nav > .avatar-wrap { display: block; }
    .hero,
    .decision-section, .workflow-section, .audience-section,
    .process-section, .platform-strip, .final-cta-wrap { width: min(100% - 28px, 1160px); }
    .hero { padding: 80px 0 28px; min-height: auto; }
    .hero-copy { align-items: flex-start; text-align: left; }
    .hero h1 { font-size: clamp(2.6rem, 13vw, 3.7rem); }
    .hero-sub { font-size: 16px; }
    .hero-actions { width: 100%; }
    .hero-actions .btn-primary, .hero-actions .btn-secondary { flex: 1 1 170px; }
    .analysis-panel { padding: 18px; border-radius: 18px; }
    .panel-top { flex-direction: column; }
    .score-block { width: 100%; text-align: left; }
    .signal-row { grid-template-columns: 1fr; gap: 5px; }
    .draft-header { flex-direction: column; gap: 4px; }
    .decision-section, .workflow-section, .audience-section, .process-section { min-height: auto; padding: 42px 0; }
    .platform-strip { min-height: auto; padding: 28px 0 30px; }
    .platform-track { gap: 22px 30px; justify-content: center; }
    .platform-logo { font-size: 16px; }
    .process-card { min-height: auto; padding: 24px; border-radius: 18px; }
    .process-card h3 { font-size: 24px; margin-top: 16px; }
    .process-card p { font-size: 14px; }
    .workflow-grid { grid-template-columns: 1fr; }
    .workflow-card { min-height: 150px; }
    .workflow-card h3 { margin-top: 28px; }
    .final-cta { padding: 30px 22px; }
    .final-cta-wrap { margin-bottom: 28px; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.001ms !important;
    }
    .intro-overlay { display: none; }
    .grad-text { animation: none !important; -webkit-text-fill-color: #9b8ee8; }
  }

  @media (hover: none) {
    .grad-text { animation: none; }
  }
`
