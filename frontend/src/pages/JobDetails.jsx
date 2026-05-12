import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

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

const PLATFORMS = ['Upwork', 'Freelancer', 'Other']
const LEVELS = ['Entry', 'Intermediate', 'Expert']

const INITIAL_FORM = {
  title: '', platform: 'Upwork', level: 'Intermediate',
  budget: '', budgetType: 'Fixed', timeline: '', timelineUnit: 'Weeks', description: '',
}

export default function JobDetails() {
  const navigate = useNavigate()

  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [shake, setShake] = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))
  const handleReset = () => { setForm(INITIAL_FORM); setErrors({}) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}

    const title = form.title.trim()
    if (!title) errs.title = 'Job title is required'
    else if (title.length < 5) errs.title = 'Job title must be at least 5 characters'
    else if (title.split(/\s+/).filter(Boolean).length < 3) errs.title = 'Job title must be at least 3 words'
    else if (title.length > 150) errs.title = 'Job title is too long'

    const desc = form.description.trim()
    if (!desc) errs.description = 'Paste the full job posting'
    else if (desc.length < 150) errs.description = 'Paste the full job posting — at least 150 characters'
    else if (desc.length > 8000) errs.description = 'Job posting is too long — max 8 000 characters'

    if (form.budget.trim()) {
      const budgetVal = Number(form.budget)
      if (isNaN(budgetVal) || budgetVal <= 0) errs.budget = 'Enter a valid budget amount'
      else if (budgetVal > 1_000_000) errs.budget = 'Budget seems unrealistically high'
    }

    if (form.timeline.trim()) {
      const timelineVal = Number(form.timeline)
      if (isNaN(timelineVal) || timelineVal <= 0) errs.timeline = 'Enter a valid timeline'
      else if (form.timelineUnit === 'Weeks' && timelineVal > 104) errs.timeline = 'Timeline exceeds 2 years'
      else if (form.timelineUnit === 'Months' && timelineVal > 24) errs.timeline = 'Timeline exceeds 2 years'
    }

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
      <div className="page">

        {/* ── Navbar ── */}
        <nav className="nav">
          <Logo onClick={() => navigate('/')} />
          <div className="nav-links">
            <a
              className="nav-link"
              href="https://github.com/HassanAbdullahHere/pitchforge"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
          <button className="btn-primary nav-cta" onClick={() => navigate('/')}>
            ← Back
          </button>
        </nav>

        {/* ── Page header ── */}
        <div className="page-header anim" style={{ '--delay': '0ms' }}>
          <div className="badge-pill">Step 1 of 4</div>
          <h1 className="page-title">Tell Us About the Job</h1>
          <p className="page-sub">We'll analyze fit, score the opportunity, and craft a winning proposal.</p>
        </div>

        {/* ── Form ── */}
        <form
          className={`form-wrap${shake ? ' form-wrap--shake' : ''}`}
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Light glass card */}
          <div className="glass-card anim" style={{ '--delay': '80ms' }}>

            {/* Two panel layout */}
            <div className="card-body">

              {/* LEFT — job meta */}
              <div className="panel panel-left">
                <div className="section-label">Job Details</div>

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
                  {errors.title && <span className="field-err">{errors.title}</span>}
                </div>

                {/* Platform */}
                <div className="field">
                  <label className="field-label">Platform</label>
                  <div className="pill-group">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`pill-opt${form.platform === p ? ' pill-opt--active' : ''}`}
                        onClick={() => set('platform', p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level */}
                <div className="field">
                  <label className="field-label">Experience Level</label>
                  <div className="pill-group">
                    {LEVELS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={`pill-opt${form.level === l ? ' pill-opt--active' : ''}`}
                        onClick={() => set('level', l)}
                      >
                        {l}
                      </button>
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
                        placeholder={form.budgetType === 'Per Hour' ? 'e.g. 40' : 'e.g. 500'}
                        value={form.budget}
                        onChange={(e) => { set('budget', e.target.value); setErrors((err) => ({ ...err, budget: undefined })) }}
                      />
                      <Wheel
                        options={['Fixed', 'Per Hour']}
                        value={form.budgetType}
                        onChange={(v) => set('budgetType', v)}
                      />
                    </div>
                    {errors.budget && <span className="field-err">{errors.budget}</span>}
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
                    {errors.timeline && <span className="field-err">{errors.timeline}</span>}
                  </div>
                </div>

                {/* Actions — desktop */}
                <div className="btn-row btn-row--desktop">
                  <button className="btn-secondary" type="button" onClick={handleReset}>
                    Reset
                  </button>
                  <button className="btn-primary btn-submit" type="submit">
                    Analyze Job →
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="card-divider" aria-hidden="true" />

              {/* RIGHT — job posting */}
              <div className="panel panel-right">
                <div className={`field field-full${errors.description ? ' field--error' : ''}`}>
                  <div className="textarea-header">
                    <label className="field-label">Job Posting</label>
                    <div className="textarea-meta">
                      <span className={`char-count${form.description.length > 7500 ? ' char-count--warn' : ''}`}>{form.description.length} / 8 000</span>
                      {form.description && (
                        <button
                          className="clear-btn"
                          type="button"
                          onClick={() => { set('description', ''); setErrors((err) => ({ ...err, description: false })) }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    className="field-textarea"
                    placeholder="Paste the full job posting here — the more detail you include, the sharper your proposal will be."
                    value={form.description}
                    onChange={(e) => { set('description', e.target.value); setErrors((err) => ({ ...err, description: false })) }}
                  />
                  {errors.description && <span className="field-err">{errors.description}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Actions — mobile */}
          <div className="btn-row btn-row--mobile anim" style={{ '--delay': '160ms' }}>
            <button className="btn-secondary" type="button" onClick={handleReset}>Reset</button>
            <button className="btn-primary btn-submit" type="submit">Analyze Job →</button>
          </div>
        </form>
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
    --glass-light:     rgba(226,225,222,0.76);
    --glass-light-b:   rgba(212,210,208,0.90);
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
  .anim {
    opacity: 0;
    animation: fadeUp 400ms ease forwards;
    animation-delay: var(--delay, 0ms);
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(6px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }

  /* ── Page ── */
  .page {
    position: relative;
    min-height: 100vh;
    z-index: 1;
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
    color: rgba(30,36,25,0.65);
    text-decoration: none;
    transition: color 200ms;
  }
  .nav-link:hover { color: var(--text-dark); }

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

  .nav-cta { padding: 9px 20px; font-size: 13px; }
  .btn-submit { min-width: 160px; }

  /* ── Page header ── */
  .page-header {
    padding: 20px 40px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  .badge-pill {
    display: inline-flex;
    align-items: center;
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    border-radius: 100px;
    padding: 5px 12px;
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(30,36,25,0.6);
    width: fit-content;
  }
  .page-title {
    font-family: var(--font);
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: var(--text-dark);
    line-height: 1.1;
  }
  .page-sub {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Form wrap ── */
  .form-wrap {
    flex: 1;
    padding: 16px 40px 40px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-wrap--shake { animation: shake 0.5s ease; }

  /* ── Glass card ── */
  .glass-card {
    background: var(--glass-light);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-light-b);
    border-radius: 20px;
    overflow: hidden;
  }

  .card-body {
    display: flex;
    min-height: 520px;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 32px 36px;
  }

  .panel-left {
    flex: 0 0 420px;
  }

  .panel-right {
    flex: 1;
  }

  .card-divider {
    width: 1px;
    background: rgba(30,36,25,0.07);
    flex-shrink: 0;
  }

  .section-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  /* ── Fields ── */
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-full { flex: 1; }

  .field-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .field-input {
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(30,36,25,0.1);
    border-radius: 10px;
    padding: 11px 14px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: rgba(30,36,25,0.8);
    outline: none;
    transition: border-color 200ms;
    width: 100%;
  }
  .field-input::placeholder { color: rgba(30,36,25,0.3); }
  .field-input:focus { border-color: rgba(122,184,122,0.5); box-shadow: 0 0 0 3px rgba(122,184,122,0.1); }

  .field--error .field-input,
  .field--error .field-textarea {
    border-color: rgba(220,80,80,0.4);
  }
  .field-err {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: rgba(200,60,60,0.8);
  }

  /* ── Pill options ── */
  .pill-group {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pill-opt {
    border-radius: 100px;
    background: rgba(255,255,255,0.6);
    border: 1px solid rgba(30,36,25,0.1);
    color: rgba(30,36,25,0.65);
    padding: 7px 14px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 400;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: all 200ms;
  }
  .pill-opt:hover { border-color: rgba(30,36,25,0.2); color: var(--text-dark); }
  .pill-opt--active {
    background: rgba(26,31,22,0.88);
    border-color: transparent;
    color: rgba(255,255,255,0.92);
  }

  /* ── Field row ── */
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  /* ── Input + Wheel ── */
  .input-wheel-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  .input-wheel-row .field-input { flex: 1; }

  /* ── Drum Wheel ── */
  .wheel {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 78px;
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(30,36,25,0.1);
    border-radius: 10px;
    overflow: hidden;
  }
  .wheel-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: rgba(30,36,25,0.3);
    font-size: 8px;
    line-height: 1;
    padding: 5px 0;
    width: 100%;
    transition: color 150ms, background 150ms;
  }
  .wheel-btn:hover { color: var(--text-dark); background: rgba(30,36,25,0.04); }

  .wheel-track {
    overflow: hidden;
    height: 22px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-top: 1px solid rgba(30,36,25,0.07);
    border-bottom: 1px solid rgba(30,36,25,0.07);
    background: rgba(122,184,122,0.08);
  }
  .wheel-val {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(30,36,25,0.7);
    white-space: nowrap;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .textarea-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .char-count {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: var(--text-muted);
    transition: color 0.2s;
  }
  .char-count--warn {
    color: #e8793a;
    font-weight: 600;
  }
  .clear-btn {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(30,36,25,0.45);
    background: transparent;
    border: 1px solid rgba(30,36,25,0.1);
    border-radius: 100px;
    padding: 3px 10px;
    cursor: pointer;
    transition: all 200ms;
  }
  .clear-btn:hover { color: rgba(200,60,60,0.8); border-color: rgba(200,60,60,0.3); }

  .field-textarea {
    flex: 1;
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(30,36,25,0.1);
    border-radius: 12px;
    padding: 14px 16px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.7;
    color: rgba(30,36,25,0.8);
    outline: none;
    resize: vertical;
    min-height: 360px;
    transition: border-color 200ms;
    width: 100%;
  }
  .field-textarea::placeholder { color: rgba(30,36,25,0.3); line-height: 1.7; }
  .field-textarea:focus {
    border-color: rgba(122,184,122,0.5);
    box-shadow: 0 0 0 3px rgba(122,184,122,0.1);
  }

  /* ── Button rows ── */
  .btn-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: auto;
  }
  .btn-row--mobile { display: none; }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .nav { padding: 16px 20px; }
    .nav-links { display: none; }

    .page-header { padding: 16px 20px 4px; }
    .page-title { font-size: 1.6rem; }

    .form-wrap { padding: 12px 16px 32px; }

    .card-body { flex-direction: column; }
    .panel { padding: 24px 20px; gap: 16px; }
    .panel-left { flex: unset; }
    .card-divider { width: 100%; height: 1px; }

    .field-row { grid-template-columns: 1fr; gap: 14px; }
    .field-textarea { min-height: 220px; }

    .btn-row--desktop { display: none; }
    .btn-row--mobile { display: flex; }
    .btn-row--mobile .btn-primary { flex: 1; }
  }
`
