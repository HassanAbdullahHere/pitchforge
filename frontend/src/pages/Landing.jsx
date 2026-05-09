import { useEffect, useRef } from 'react'

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + Math.random() * 84}%`,
  delay: `${Math.random() * 6}s`,
  duration: `${4 + Math.random() * 5}s`,
  size: `${1.5 + Math.random() * 2.5}px`,
  opacity: 0.2 + Math.random() * 0.5,
}))

const HEADLINE_WORDS = ['Forge', 'Proposals', 'That', 'Win.']

export default function Landing() {
  const glowRef = useRef(null)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!glowRef.current) return
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      glowRef.current.style.setProperty('--mx', `${x}%`)
      glowRef.current.style.setProperty('--my', `${y}%`)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <>
      <style>{css}</style>

      <div className="landing" ref={glowRef}>
        {/* Mouse-tracking radial glow */}
        <div className="glow-cursor" />

        {/* Background layers */}
        <div className="bg-grid" />
        <div className="bg-vignette" />

        {/* Forge sparks */}
        <div className="sparks" aria-hidden="true">
          {SPARKS.map((s) => (
            <span
              key={s.id}
              className="spark"
              style={{
                left: s.left,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animationDelay: s.delay,
                animationDuration: s.duration,
              }}
            />
          ))}
        </div>

        {/* Decorative lines */}
        <div className="deco-lines" aria-hidden="true">
          <span className="deco-line deco-line--1" />
          <span className="deco-line deco-line--2" />
          <span className="deco-line deco-line--3" />
        </div>

        {/* Nav */}
        <nav className="nav">
          <span className="nav-wordmark">
            <span className="nav-wordmark-pitch">Pitch</span>
            <span className="nav-wordmark-forge">Forge</span>
          </span>
          <a
            className="nav-github"
            href="https://github.com/HassanAbdullahHere/pitchforge"
            target="_blank"
            rel="noreferrer"
          >
            <svg className="nav-github-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            GitHub
          </a>
        </nav>

        {/* Hero */}
        <main className="hero">
          <p className="eyebrow">
            <span className="eyebrow-line" />
            AI Proposal Intelligence
            <span className="eyebrow-line" />
          </p>

          <div className="headline-halo" aria-hidden="true" />

          <h1 className="headline" aria-label="Forge Proposals That Win.">
            {HEADLINE_WORDS.map((word, i) => (
              <span
                key={word}
                className="headline-word"
                style={{ animationDelay: `${0.3 + i * 0.18}s` }}
              >
                {word}
              </span>
            ))}
          </h1>

          <p className="subtitle">
            Paste a job posting. Walk away with a proposal that sounds like you,
            <br className="subtitle-br" />
            scores your fit, prices your work, and wins the client.
          </p>

          <div className="cta-wrapper">
            <button className="cta-btn" onClick={() => {}}>
              <span className="cta-btn-text">Get Started</span>
              <span className="cta-btn-arrow">→</span>
              <span className="cta-btn-glow" />
            </button>
          </div>

          <div className="process-strip" aria-label="How it works">
            {[
              { n: '01', label: 'Analyze' },
              { n: '02', label: 'Score' },
              { n: '03', label: 'Draft' },
              { n: '04', label: 'Approve' },
            ].map((step, i) => (
              <div key={step.n} className="process-step" style={{ animationDelay: `${1.3 + i * 0.12}s` }}>
                <span className="process-n">{step.n}</span>
                <span className="process-label">{step.label}</span>
                {i < 3 && <span className="process-connector" />}
              </div>
            ))}
          </div>

          <p className="disclaimer">
            Powered by&nbsp;
            <span className="disclaimer-gemini">Gemini</span>
          </p>
        </main>

        {/* Bottom forge mark */}
        <div className="forge-mark" aria-hidden="true">
          <span className="forge-mark-line" />
          <span className="forge-mark-label">EST. 2025</span>
          <span className="forge-mark-line" />
        </div>
      </div>
    </>
  )
}

const css = `
  :root {
    --bg:        #0a0908;
    --gold:      #c9a84c;
    --gold-dim:  #8a6d2e;
    --fire:      #e8793a;
    --ivory:     #f5f0e8;
    --ivory-dim: #9c9389;
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --font-mono:    'JetBrains Mono', 'Courier New', monospace;
  }

  .landing {
    position: relative;
    min-height: 100vh;
    width: 100%;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    --mx: 50%;
    --my: 50%;
  }

  /* ── Mouse glow ── */
  .glow-cursor {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      600px circle at var(--mx) var(--my),
      rgba(201,168,76,0.055) 0%,
      transparent 70%
    );
    z-index: 1;
    transition: background 0.1s ease;
  }

  /* ── Background grid ── */
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%);
    pointer-events: none;
  }

  .bg-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 100% 90% at 50% 50%, transparent 30%, #0a0908 100%);
    pointer-events: none;
  }

  /* ── Sparks ── */
  .sparks {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .spark {
    position: absolute;
    bottom: -4px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 6px 2px rgba(201,168,76,0.6), 0 0 12px 4px rgba(232,121,58,0.3);
    animation: rise linear infinite;
    will-change: transform, opacity;
  }

  @keyframes rise {
    0%   { transform: translateY(0)     scale(1);   opacity: var(--op, 0.5); }
    60%  { opacity: var(--op, 0.4); }
    85%  { transform: translateY(-80vh) scale(0.4); opacity: 0.1; }
    100% { transform: translateY(-95vh) scale(0);   opacity: 0; }
  }

  /* ── Decorative lines ── */
  .deco-lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .deco-line {
    position: absolute;
    background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
    height: 1px;
    opacity: 0;
    animation: line-draw 1.2s ease forwards;
  }

  .deco-line--1 {
    width: 340px;
    top: 18%;
    left: -20px;
    transform: rotate(-8deg);
    animation-delay: 0.6s;
  }

  .deco-line--2 {
    width: 220px;
    bottom: 28%;
    right: -10px;
    transform: rotate(6deg);
    animation-delay: 0.9s;
  }

  .deco-line--3 {
    width: 160px;
    top: 62%;
    left: 6%;
    transform: rotate(-3deg);
    animation-delay: 1.1s;
  }

  @keyframes line-draw {
    from { opacity: 0; transform: scaleX(0) rotate(var(--r, -8deg)); }
    to   { opacity: 1; transform: scaleX(1) rotate(var(--r, -8deg)); }
  }

  /* ── Nav ── */
  .nav {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2rem 3rem;
    animation: fade-up 0.8s ease 0.1s both;
  }

  .nav-wordmark {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 500;
    letter-spacing: 0.06em;
  }

  .nav-wordmark-pitch { color: var(--ivory); }
  .nav-wordmark-forge { color: var(--gold); }

  .nav-github {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ivory-dim);
    text-decoration: none;
    transition: color 0.25s ease;
  }

  .nav-github:hover {
    color: var(--gold);
  }

  .nav-github-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .disclaimer-gemini {
    color: var(--gold);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
  }

  /* ── Hero ── */
  .hero {
    position: relative;
    z-index: 10;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem 2rem 4rem;
    gap: 0;
  }

  /* Eyebrow */
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 2.2rem;
    animation: fade-up 0.8s ease 0.2s both;
  }

  .eyebrow-line {
    display: block;
    width: 40px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold));
  }

  .eyebrow-line:last-child {
    background: linear-gradient(90deg, var(--gold), transparent);
  }

  /* Headline */
  .headline {
    font-family: var(--font-display);
    font-size: clamp(4.5rem, 10vw, 8.5rem);
    font-weight: 300;
    line-height: 1.0;
    letter-spacing: -0.01em;
    color: var(--ivory);
    margin-bottom: 2.2rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25em;
  }

  .headline-word {
    display: inline-block;
    opacity: 0;
    animation: word-reveal 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .headline-word:nth-child(3) {
    font-style: italic;
    color: var(--gold);
  }

  .headline-word:last-child {
    color: var(--fire);
  }

  @keyframes word-reveal {
    from {
      opacity: 0;
      transform: translateY(28px) skewY(2deg);
      filter: blur(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0) skewY(0deg);
      filter: blur(0);
    }
  }

  /* Subtitle */
  .subtitle {
    font-family: var(--font-display);
    font-size: clamp(1.2rem, 2.4vw, 1.6rem);
    font-weight: 300;
    color: var(--ivory-dim);
    line-height: 1.7;
    max-width: 600px;
    margin-bottom: 3rem;
    animation: fade-up 0.9s ease 0.9s both;
  }

  .subtitle-br { display: none; }
  @media (min-width: 640px) { .subtitle-br { display: inline; } }

  /* CTA */
  .cta-wrapper {
    animation: fade-up 0.9s ease 1.1s both;
  }

  .cta-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2.5rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ivory);
    background: transparent;
    border: 1px solid var(--gold-dim);
    cursor: pointer;
    overflow: hidden;
    transition: color 0.3s ease, border-color 0.3s ease;
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
  }

  .cta-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(201,168,76,0.12), rgba(232,121,58,0.08));
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .cta-btn:hover {
    border-color: var(--gold);
    color: var(--gold);
  }

  .cta-btn:hover::before {
    opacity: 1;
  }

  .cta-btn:hover .cta-btn-glow {
    opacity: 1;
  }

  .cta-btn:hover .cta-btn-arrow {
    transform: translateX(4px);
  }

  .cta-btn-text {
    position: relative;
    z-index: 1;
  }

  .cta-btn-arrow {
    position: relative;
    z-index: 1;
    transition: transform 0.3s ease;
    font-size: 1rem;
  }

  .cta-btn-glow {
    position: absolute;
    inset: -2px;
    border-radius: 0;
    background: transparent;
    box-shadow: 0 0 24px 4px rgba(201,168,76,0.25), 0 0 50px 8px rgba(232,121,58,0.1);
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
  }

  /* Headline halo */
  .headline-halo {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 700px;
    height: 260px;
    background: radial-gradient(ellipse at center, rgba(201,168,76,0.18) 0%, transparent 70%);
    filter: blur(60px);
    pointer-events: none;
    opacity: 0;
    animation: fade-in-slow 2s ease 0.8s forwards;
    z-index: 0;
  }

  @keyframes fade-in-slow {
    to { opacity: 1; }
  }

  /* Process strip */
  .process-strip {
    display: flex;
    align-items: center;
    gap: 0;
    margin-top: 2.8rem;
    margin-bottom: 0.2rem;
    animation: none;
  }

  .process-step {
    display: flex;
    align-items: center;
    gap: 0;
    opacity: 0;
    animation: fade-up 0.6s ease forwards;
  }

  .process-n {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--gold-dim);
    letter-spacing: 0.1em;
    margin-right: 0.5rem;
    line-height: 1;
  }

  .process-label {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ivory-dim);
    transition: color 0.25s ease;
  }

  .process-step:hover .process-label {
    color: var(--gold);
  }

  .process-connector {
    display: block;
    width: 48px;
    height: 1px;
    margin: 0 1rem;
    background: repeating-linear-gradient(
      90deg,
      var(--gold-dim) 0px,
      var(--gold-dim) 3px,
      transparent 3px,
      transparent 7px
    );
    opacity: 0.5;
  }

  /* CTA ambient pulse */
  .cta-btn::after {
    content: '';
    position: absolute;
    inset: -1px;
    border: 1px solid var(--gold);
    opacity: 0;
    animation: ring-pulse 2.5s ease-out 1.8s infinite;
    pointer-events: none;
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
  }

  .cta-btn:hover::after {
    animation: none;
  }

  @keyframes ring-pulse {
    0%   { opacity: 0.35; transform: scale(1); }
    70%  { opacity: 0;    transform: scale(1.12); }
    100% { opacity: 0;    transform: scale(1.12); }
  }

  /* Disclaimer */
  .disclaimer {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    color: #4a4540;
    margin-top: 1.6rem;
    animation: fade-up 0.8s ease 1.4s both;
  }

  /* ── Forge mark (bottom) ── */
  .forge-mark {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.2rem;
    padding: 1.5rem 3rem;
    animation: fade-up 0.8s ease 1.5s both;
  }

  .forge-mark-line {
    display: block;
    width: 60px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #3a3530);
  }

  .forge-mark-line:last-child {
    background: linear-gradient(90deg, #3a3530, transparent);
  }

  .forge-mark-label {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.24em;
    color: #3a3530;
  }

  /* ── Shared keyframes ── */
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`
