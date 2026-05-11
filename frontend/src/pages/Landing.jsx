import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

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
  const navigate = useNavigate()
  const hiwRef = useRef(null)

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
        <nav className="nav">
          <Logo />
          <div className="nav-links">
            <a
              className="nav-link"
              href="https://github.com/HassanAbdullahHere/pitchforge"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <button className="nav-link nav-link-btn" onClick={scrollToHIW}>How It Works</button>
          </div>
          <button className="btn-primary nav-cta" onClick={() => navigate('/new')}>
            Get Started
          </button>
        </nav>

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
              <span className="powered-name">Gemini 2.5 Flash</span>
              <span className="powered-sub">+ LangGraph Pipeline</span>
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
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 40px;
    position: relative;
    z-index: 10;
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

  .nav-cta {
    padding: 9px 20px;
    font-size: 13px;
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
  .btn-primary:hover { transform: scale(1.02); }

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
  .btn-secondary:hover { transform: scale(1.02); }

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
    border-color: rgba(122,184,122,0.18);
  }

  .powered-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-light-muted);
  }

  .powered-name {
    font-family: var(--font);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--accent);
    margin-top: 4px;
  }

  .powered-sub {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: rgba(255,255,255,0.25);
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
    .nav { padding: 16px 20px; }
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
