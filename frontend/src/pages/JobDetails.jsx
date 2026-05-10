import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

function Wheel({ options, value, onChange }) {
  const [rolling, setRolling] = useState(null) // 'up' | 'down'
  const idx = options.indexOf(value)

  const spin = (dir) => {
    setRolling(dir)
    setTimeout(() => {
      const next = dir === 'up'
        ? options[(idx - 1 + options.length) % options.length]
        : options[(idx + 1) % options.length]
      onChange(next)
      setRolling(null)
    }, 180)
  }

  return (
    <div className="wheel">
      <button type="button" className="wheel-btn" onClick={() => spin('up')}>▲</button>
      <div className={`wheel-track${rolling ? ` wheel-track--${rolling}` : ''}`}>
        <span className="wheel-val">{value}</span>
      </div>
      <button type="button" className="wheel-btn" onClick={() => spin('down')}>▼</button>
    </div>
  )
}

const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: `${8 + Math.random() * 84}%`,
  delay: `${Math.random() * 6}s`,
  duration: `${4 + Math.random() * 5}s`,
  size: `${1.5 + Math.random() * 2}px`,
  opacity: 0.15 + Math.random() * 0.3,
}))

const PLATFORMS = ['Upwork', 'Freelancer', 'Other']
const LEVELS = ['Entry', 'Intermediate', 'Expert']

export default function JobDetails() {
  const navigate = useNavigate()
  const glowRef = useRef(null)

  const [form, setForm] = useState({
    title: '', platform: 'Upwork', level: 'Intermediate',
    budget: '', budgetType: 'Fixed', timeline: '', timelineUnit: 'Weeks', description: '',
  })
  const [errors, setErrors] = useState({})
  const [shake, setShake] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!glowRef.current) return
      glowRef.current.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}%`)
      glowRef.current.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}%`)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const INITIAL_FORM = {
    title: '', platform: 'Upwork', level: 'Intermediate',
    budget: '', budgetType: 'Fixed', timeline: '', timelineUnit: 'Weeks', description: '',
  }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleReset = () => { setForm(INITIAL_FORM); setErrors({}) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}

    const title = form.title.trim()
    if (!title) errs.title = 'Job title is required'
    else if (title.length < 5) errs.title = 'Job title must be at least 5 characters'
    else if (title.length > 150) errs.title = 'Job title is too long'

    const desc = form.description.trim()
    if (!desc) errs.description = 'Paste the full job posting'
    else if (desc.length < 150) errs.description = 'Paste the full job posting — at least 150 characters'

    if (form.budget.trim() && (isNaN(Number(form.budget)) || Number(form.budget) <= 0))
      errs.budget = 'Enter a valid budget amount'

    if (form.timeline.trim() && (isNaN(Number(form.timeline)) || Number(form.timeline) <= 0))
      errs.timeline = 'Enter a valid timeline'

    if (Object.keys(errs).length) {
      setErrors(errs)
      setShake(true)
      setTimeout(() => setShake(false), 600)
      return
    }

    setErrors({})
    navigate('/analyze', { state: { form } })
  }

  return (
    <>
      <style>{css}</style>

      <div className="jd-page" ref={glowRef}>
        <div className="glow-cursor" />
        <div className="bg-grid" />
        <div className="bg-vignette" />
        <div className="bg-grain" />

        <div className="sparks" aria-hidden="true">
          {SPARKS.map((s) => (
            <span key={s.id} className="spark" style={{
              left: s.left, width: s.size, height: s.size,
              opacity: s.opacity, animationDelay: s.delay, animationDuration: s.duration,
            }} />
          ))}
        </div>

        {/* Nav */}
        <nav className="nav">
          <button className="nav-wordmark" onClick={() => navigate('/')}>
            <span className="nav-wordmark-pitch">Pitch</span>
            <span className="nav-wordmark-forge">Forge</span>
          </button>
          <a className="nav-github" href="https://github.com/HassanAbdullahHere/pitchforge" target="_blank" rel="noreferrer">
            <svg className="nav-github-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            GitHub
          </a>
        </nav>

        {/* Split panel */}
        <form
          className={`split${shake ? ' split--shake' : ''}`}
          onSubmit={handleSubmit}
          noValidate
        >
          {/* LEFT */}
          <div className="panel panel--left">
            <div className="step-header">
              <span className="step-n">01</span>
              <span className="step-divider" />
              <span className="step-title">Load the Job</span>
            </div>

            {/* Title */}
            <div className={`field${errors.title ? ' field--error' : ''}`}>
              <label className="field-label">Job Title</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. Full-Stack Web App Developer"
                value={form.title}
                onChange={(e) => { set('title', e.target.value); setErrors((err) => ({ ...err, title: false })) }}
              />
              {errors.title && <span className="field-err-msg">{errors.title}</span>}
            </div>

            {/* Platform */}
            <div className="field">
              <label className="field-label">Platform</label>
              <div className="pills">
                {PLATFORMS.map((p) => (
                  <button key={p} type="button"
                    className={`pill${form.platform === p ? ' pill--active' : ''}`}
                    onClick={() => set('platform', p)}
                  >{p}</button>
                ))}
              </div>
            </div>

            {/* Level */}
            <div className="field">
              <label className="field-label">Experience Level</label>
              <div className="pills">
                {LEVELS.map((l) => (
                  <button key={l} type="button"
                    className={`pill${form.level === l ? ' pill--active' : ''}`}
                    onClick={() => set('level', l)}
                  >{l}</button>
                ))}
              </div>
            </div>

            {/* Budget + Timeline */}
            <div className="field-row">
              <div className={`field${errors.budget ? ' field--error' : ''}`}>
                <label className="field-label">Budget</label>
                <div className="input-wheel-row">
                  <input
                    className="field-input"
                    type="text"
                    placeholder={form.budgetType === 'Per Hour' ? 'e.g. $40' : 'e.g. $500'}
                    value={form.budget}
                    onChange={(e) => { set('budget', e.target.value); setErrors((err) => ({ ...err, budget: undefined })) }}
                  />
                  <Wheel
                    options={['Fixed', 'Per Hour']}
                    value={form.budgetType}
                    onChange={(v) => set('budgetType', v)}
                  />
                </div>
                {errors.budget && <span className="field-err-msg">{errors.budget}</span>}
              </div>
              <div className={`field${errors.timeline ? ' field--error' : ''}`}>
                <label className="field-label">Timeline</label>
                <div className="input-wheel-row">
                  <input
                    className="field-input"
                    type="text"
                    placeholder="e.g. 2"
                    value={form.timeline}
                    onChange={(e) => { set('timeline', e.target.value); setErrors((err) => ({ ...err, timeline: undefined })) }}
                  />
                  <Wheel
                    options={['Weeks', 'Months']}
                    value={form.timelineUnit}
                    onChange={(v) => set('timelineUnit', v)}
                  />
                </div>
                {errors.timeline && <span className="field-err-msg">{errors.timeline}</span>}
              </div>
            </div>

            {/* Action row — desktop only */}
            <div className="btn-row btn-row--desktop">
              <button className="reset-btn" type="button" onClick={handleReset}>↺ Reset</button>
              <button className="cta-btn" type="submit">
                <span className="cta-btn-text">Analyze Job</span>
                <span className="cta-btn-arrow">→</span>
                <span className="cta-btn-glow" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="panel-divider" aria-hidden="true" />

          {/* RIGHT */}
          <div className="panel panel--right">
            <div className={`field field--full${errors.description ? ' field--error' : ''}`}>
              <div className="textarea-header">
                <label className="field-label">Job Posting</label>
                <div className="textarea-header-right">
                  <span className="char-count">{form.description.length} chars</span>
                  {form.description && (
                    <button className="clear-btn" type="button"
                      onClick={() => { set('description', ''); setErrors((err) => ({ ...err, description: false })) }}
                    >Clear</button>
                  )}
                </div>
              </div>
              <textarea
                className="field-textarea"
                placeholder="Paste the full job posting here — the more detail you include, the sharper your proposal will be."
                value={form.description}
                onChange={(e) => { set('description', e.target.value); setErrors((err) => ({ ...err, description: false })) }}
              />
              {errors.description && <span className="field-err-msg">{errors.description}</span>}
            </div>
          </div>

          {/* Action row — mobile only (after job desc) */}
          <div className="btn-row btn-row--mobile">
            <button className="reset-btn" type="button" onClick={handleReset}>↺ Reset</button>
            <button className="cta-btn" type="submit">
              <span className="cta-btn-text">Analyze Job</span>
              <span className="cta-btn-arrow">→</span>
              <span className="cta-btn-glow" />
            </button>
          </div>
        </form>
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

  .jd-page {
    position: relative;
    min-height: 100vh;
    width: 100%;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    --mx: 50%; --my: 50%;
  }

  /* ── Shared background layers (identical to Landing) ── */
  .glow-cursor {
    position: fixed; inset: 0; pointer-events: none; z-index: 1;
    background: radial-gradient(600px circle at var(--mx) var(--my), rgba(201,168,76,0.05) 0%, transparent 70%);
  }
  .bg-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%);
  }
  .bg-vignette {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse 100% 90% at 50% 50%, transparent 30%, #0a0908 100%);
  }
  .bg-grain {
    position: fixed; inset: 0; pointer-events: none; z-index: 3;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px; opacity: 0.03; mix-blend-mode: screen;
  }
  .sparks { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .spark {
    position: absolute; bottom: -4px; border-radius: 50%; background: var(--gold);
    box-shadow: 0 0 6px 2px rgba(201,168,76,0.6), 0 0 12px 4px rgba(232,121,58,0.3);
    animation: rise linear infinite; will-change: transform, opacity;
  }
  @keyframes rise {
    0%   { transform: translateY(0) scale(1); }
    85%  { transform: translateY(-80vh) scale(0.4); opacity: 0.1; }
    100% { transform: translateY(-95vh) scale(0); opacity: 0; }
  }

  /* ── Nav ── */
  .nav {
    position: relative; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.75rem 3rem;
    animation: fade-up 0.6s ease both;
    border-bottom: 1px solid rgba(201,168,76,0.08);
  }
  .nav-wordmark {
    font-family: var(--font-display); font-size: 1.5rem; font-weight: 500;
    letter-spacing: 0.06em; background: none; border: none; cursor: pointer; padding: 0;
  }
  .nav-wordmark-pitch { color: var(--ivory); }
  .nav-wordmark-forge { color: var(--gold); }
  .nav-github {
    display: inline-flex; align-items: center; gap: 0.45rem;
    font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ivory-dim); text-decoration: none;
    transition: color 0.25s ease;
  }
  .nav-github:hover { color: var(--gold); }
  .nav-github-icon { width: 20px; height: 20px; flex-shrink: 0; }

  /* ── Split layout ── */
  .split {
    position: relative; z-index: 10;
    flex: 1; display: flex;
    padding: 3rem;
    gap: 0;
    animation: fade-up 0.7s ease 0.15s both;
  }

  .split--shake {
    animation: shake 0.5s ease;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(6px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }

  .panel { display: flex; flex-direction: column; }

  .panel--left {
    flex: 0 0 460px;
    padding-right: 3.5rem;
    gap: 2rem;
  }

  .panel--right {
    flex: 1;
    padding-left: 3rem;
  }

  .panel-divider {
    width: 1px;
    background: linear-gradient(to bottom, transparent, var(--gold-dim) 20%, var(--gold-dim) 80%, transparent);
    opacity: 0.35;
    flex-shrink: 0;
  }

  /* ── Step header ── */
  .step-header {
    display: flex; align-items: center; gap: 0.9rem;
    margin-bottom: 0.5rem;
  }
  .step-n {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--gold); letter-spacing: 0.14em;
  }
  .step-divider {
    display: block; flex: 0 0 24px; height: 1px;
    background: linear-gradient(90deg, var(--gold-dim), transparent);
  }
  .step-title {
    font-family: var(--font-display); font-size: 2.2rem;
    font-weight: 300; font-style: italic; color: var(--ivory);
  }

  /* ── Fields ── */
  .field { display: flex; flex-direction: column; gap: 0.5rem; }
  .field--full { flex: 1; }

  .field-label {
    font-family: var(--font-mono); font-size: 0.72rem;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--gold);
  }

  .field-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--gold-dim);
    color: var(--ivory);
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 300;
    padding: 0.45rem 0;
    outline: none;
    transition: border-color 0.25s ease;
    width: 100%;
  }
  .field-input::placeholder { color: #6e6560; }
  .field-input:focus { border-bottom-color: var(--gold); }

  .field--error .field-input,
  .field--error .field-textarea { border-bottom-color: var(--fire); }

  .field-err-msg {
    font-family: var(--font-mono); font-size: 0.58rem;
    letter-spacing: 0.1em; color: var(--fire);
  }

  /* ── Pills ── */
  .pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .pill {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ivory-dim);
    background: transparent;
    border: 1px solid var(--gold-dim);
    padding: 0.35rem 0.9rem;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, background 0.2s;
    clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
  }
  .pill:hover { border-color: var(--gold); color: var(--gold); }
  .pill--active {
    background: var(--gold); border-color: var(--gold);
    color: var(--bg); font-weight: 500;
  }

  /* ── Field row ── */
  .field-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;
  }

  /* ── Input + wheel row ── */
  .input-wheel-row {
    display: flex; align-items: flex-end; gap: 0.6rem;
  }
  .input-wheel-row .field-input { flex: 1; }

  /* ── Drum wheel ── */
  .wheel {
    display: flex; flex-direction: column; align-items: center;
    gap: 0; flex-shrink: 0; width: 72px;
    border: 1px solid var(--gold-dim);
    clip-path: polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%);
  }
  .wheel-btn {
    background: transparent; border: none; cursor: pointer;
    color: var(--gold-dim); font-size: 0.45rem; line-height: 1;
    padding: 0.25rem 0.55rem;
    transition: color 0.15s;
  }
  .wheel-btn:hover { color: var(--gold); }

  .wheel-track {
    overflow: hidden; height: 1.15rem; width: 100%;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
    border-top: 1px solid rgba(138,109,46,0.3);
    border-bottom: 1px solid rgba(138,109,46,0.3);
    background: rgba(201,168,76,0.06);
  }
  .wheel-val {
    font-family: var(--font-mono); font-size: 0.55rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--gold); white-space: nowrap;
    display: block;
  }
  @keyframes roll-up {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
  @keyframes roll-down {
    from { transform: translateY(-8px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .wheel-track--up   .wheel-val { animation: roll-up   0.18s ease both; }
  .wheel-track--down .wheel-val { animation: roll-down 0.18s ease both; }

  /* ── Textarea ── */
  .textarea-header {
    display: flex; align-items: center; justify-content: space-between;
  }
  .char-count {
    font-family: var(--font-mono); font-size: 0.68rem;
    letter-spacing: 0.1em; color: var(--ivory-dim);
  }

  .field-textarea {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--gold-dim);
    border-left: 1px solid rgba(201,168,76,0.12);
    color: var(--ivory);
    font-family: var(--font-mono);
    font-size: 0.92rem;
    font-weight: 300;
    line-height: 1.75;
    padding: 1rem;
    outline: none;
    resize: vertical;
    min-height: 340px;
    transition: border-color 0.25s ease;
    width: 100%;
  }
  .field-textarea::placeholder { color: #6e6560; line-height: 1.75; }
  .field-textarea:focus {
    border-bottom-color: var(--gold);
    border-left-color: rgba(201,168,76,0.3);
  }

  /* ── Textarea header right cluster ── */
  .textarea-header-right {
    display: flex; align-items: center; gap: 0.75rem;
  }

  .clear-btn {
    font-family: var(--font-mono); font-size: 0.58rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ivory-dim); background: transparent;
    border: 1px solid rgba(138,109,46,0.4);
    padding: 0.18rem 0.55rem; cursor: pointer;
    clip-path: polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%);
    transition: color 0.2s, border-color 0.2s;
  }
  .clear-btn:hover { color: var(--fire); border-color: var(--fire); }

  /* ── Button row ── */
  .btn-row {
    display: flex; align-items: center; gap: 1rem;
    margin-top: auto;
  }

  .reset-btn {
    font-family: var(--font-mono); font-size: 0.72rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ivory-dim); background: transparent;
    border: 1px solid rgba(138,109,46,0.4);
    padding: 0.75rem 1.25rem; cursor: pointer;
    clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
    transition: color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }
  .reset-btn:hover { color: var(--fire); border-color: var(--fire); }

  .btn-row--mobile { display: none; }

  /* ── CTA ── */
  .cta-btn {
    position: relative; display: inline-flex; align-items: center;
    gap: 0.75rem; padding: 1rem 2.2rem;
    font-family: var(--font-mono); font-size: 0.82rem;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--ivory); background: transparent;
    border: 1px solid var(--gold-dim); cursor: pointer; overflow: hidden;
    transition: color 0.3s ease, border-color 0.3s ease;
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
    margin-top: auto;
    align-self: flex-start;
  }
  .cta-btn::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(201,168,76,0.12), rgba(232,121,58,0.08));
    opacity: 0; transition: opacity 0.3s ease;
  }
  .cta-btn::after {
    content: ''; position: absolute; inset: -1px;
    border: 1px solid var(--gold); opacity: 0;
    animation: ring-pulse 2.5s ease-out 2s infinite;
    pointer-events: none;
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
  }
  .cta-btn:hover { border-color: var(--gold); color: var(--gold); }
  .cta-btn:hover::before { opacity: 1; }
  .cta-btn:hover::after { animation: none; }
  .cta-btn:hover .cta-btn-glow { opacity: 1; }
  .cta-btn:hover .cta-btn-arrow { transform: translateX(4px); }
  .cta-btn-text { position: relative; z-index: 1; }
  .cta-btn-arrow { position: relative; z-index: 1; transition: transform 0.3s ease; font-size: 1rem; }
  .cta-btn-glow {
    position: absolute; inset: -2px; background: transparent;
    box-shadow: 0 0 24px 4px rgba(201,168,76,0.25), 0 0 50px 8px rgba(232,121,58,0.1);
    opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
  }

  @keyframes ring-pulse {
    0%   { opacity: 0.35; transform: scale(1); }
    70%  { opacity: 0;    transform: scale(1.1); }
    100% { opacity: 0;    transform: scale(1.1); }
  }

  /* ── Shared ── */
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Tablet ── */
  @media (max-width: 900px) {
    .panel--left { flex: 0 0 340px; padding-right: 2rem; }
    .panel--right { padding-left: 2rem; }
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .nav { padding: 1.25rem; }
    .nav-wordmark { font-size: 1.2rem; }
    .nav-github-icon { width: 16px; height: 16px; }

    .split {
      flex-direction: column;
      padding: 1.5rem 1.25rem 2.5rem;
      gap: 0;
    }

    .panel--left {
      flex: unset;
      width: 100%;
      padding-right: 0;
      gap: 1.6rem;
    }

    .panel--right {
      width: 100%;
      padding-left: 0;
      margin-top: 0;
    }

    .panel-divider {
      width: 100%;
      height: 1px;
      margin: 2rem 0;
      background: linear-gradient(to right, transparent, var(--gold-dim) 20%, var(--gold-dim) 80%, transparent);
    }

    .step-title { font-size: 1.75rem; }

    .field-row {
      grid-template-columns: 1fr !important;
      gap: 1.4rem;
    }

    .input-wheel-row { gap: 0.5rem; }
    .wheel { width: 68px; }

    .field-textarea { min-height: 200px; font-size: 0.88rem; }
    .field-input { font-size: 1.1rem; }

    .pills { gap: 0.4rem; }

    .pill { font-size: 0.6rem; padding: 0.3rem 0.75rem; }

    .btn-row--desktop { display: none; }
    .btn-row--mobile {
      display: flex; width: 100%;
      padding-top: 1.5rem; gap: 0.75rem;
    }
    .btn-row--mobile .cta-btn {
      flex: 1; justify-content: center;
      padding: 0.9rem 1.5rem; font-size: 0.78rem;
    }
    .btn-row--mobile .reset-btn {
      padding: 0.75rem 1rem; font-size: 0.68rem;
    }
  }
`
