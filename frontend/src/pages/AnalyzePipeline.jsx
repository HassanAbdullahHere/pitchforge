import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'

const NODES = [
  { key: 'analyzer',       label: 'Analyzing',  sub: 'job posting' },
  { key: 'retriever',      label: 'Retrieving', sub: 'profile matches' },
  { key: 'scorer',         label: 'Scoring',    sub: 'job fit' },
  { key: 'fit_checkpoint', label: 'Evaluating', sub: 'fit result' },
]

const INIT_STATES = Object.fromEntries(NODES.map(n => [n.key, 'idle']))
const CIRC = 2 * Math.PI * 70

export default function AnalyzePipeline() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const form = state?.form

  const [nodeStates, setNodeStates]   = useState(INIT_STATES)
  const [phase, setPhase]             = useState('streaming')
  const [fitData, setFitData]         = useState(null)
  const [statusText, setStatusText]   = useState('Connecting to pipeline…')
  const [errorMsg, setErrorMsg]       = useState(null)
  const [displayScore, setDisplayScore] = useState(0)
  const [meterOffset, setMeterOffset] = useState(CIRC)

  useEffect(() => {
    if (!form) { navigate('/new', { replace: true }); return }

    const ctrl = new AbortController()

    ;(async () => {
      try {
        const payload = {
          title: form.title,
          description: form.description,
          budget: form.budget ? `${form.budget} ${form.budgetType}` : '',
          timeline: form.timeline ? `${form.timeline} ${form.timelineUnit}` : '',
          level: form.level,
          platform: form.platform,
        }

        const res = await fetch('/api/proposal/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        })

        if (!res.ok) throw new Error(`Server returned ${res.status}`)

        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const frames = buf.split('\n\n')
          buf = frames.pop()
          for (const frame of frames) {
            if (!frame.trim()) continue
            let ev = 'message', data = null
            for (const line of frame.trim().split('\n')) {
              if (line.startsWith('event: ')) ev = line.slice(7).trim()
              if (line.startsWith('data: ')) {
                try { data = JSON.parse(line.slice(6)) } catch {}
              }
            }
            if (!data) continue

            if (ev === 'node_start') {
              setNodeStates(p => ({ ...p, [data.node]: 'active' }))
              setStatusText(data.label + '…')
            } else if (ev === 'node_complete') {
              setNodeStates(p => ({ ...p, [data.node]: 'done' }))
            } else if (ev === 'done') {
              setFitData(data)
              setPhase('result')
            } else if (ev === 'error') {
              setErrorMsg(data.message)
              setPhase('error')
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        setErrorMsg(err.message || 'Something went wrong')
        setPhase('error')
      }
    })()

    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    if (!fitData) return
    const target = fitData.fit_score
    const duration = 1600
    const start = performance.now()
    let rafId
    const tick = now => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayScore(Math.round(eased * target))
      setMeterOffset(CIRC - CIRC * (eased * target / 100))
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [fitData])

  const scoreColor = s => s >= 70 ? '#7ab87a' : s >= 40 ? '#d4a855' : '#c0392b'
  const badgeStyle = s => s >= 70
    ? { background: 'rgba(122,184,122,0.18)', color: 'rgba(25,105,25,0.95)',  border: '1px solid rgba(122,184,122,0.3)' }
    : s >= 40
    ? { background: 'rgba(212,168,85,0.15)',  color: 'rgba(135,82,0,0.95)',   border: '1px solid rgba(212,168,85,0.3)' }
    : { background: 'rgba(192,57,43,0.12)',   color: 'rgba(170,30,20,0.95)',  border: '1px solid rgba(192,57,43,0.3)' }

  return (
    <>
      <style>{css}</style>
      <div className="page">

        {/* ── Navbar ── */}
        <nav className="nav">
          <Logo onClick={() => navigate('/')} />
          {phase === 'streaming' && (
            <div className="nav-status">
              <span className="status-dot" />
              Running pipeline
            </div>
          )}
          {phase === 'result' && (
            <div className="nav-badge-pill">Analysis Complete</div>
          )}
        </nav>

        <main className="ap-main">

          {/* ══ STREAMING ══ */}
          {phase === 'streaming' && (
            <div className="center-wrap">
              <div className="dark-card pipeline-card anim" style={{ '--delay': '0ms' }}>
                <div className="card-eyebrow">
                  <span className="eyebrow-dot" />
                  Pipeline Running
                </div>
                <p className="card-title">Analyzing your job posting</p>

                <div className="node-list">
                  {NODES.map((node) => {
                    const s = nodeStates[node.key]
                    return (
                      <div key={node.key} className={`node-row node-row--${s}`}>
                        <div className={`node-circle node-circle--${s}`}>
                          {s === 'done'   && <span className="nc-check">✓</span>}
                          {s === 'active' && <span className="nc-active" />}
                          {s === 'idle'   && <span className="nc-idle" />}
                        </div>
                        <div className="node-info">
                          <span className="node-name">{node.label}</span>
                          <span className="node-sub">{node.sub}</span>
                        </div>
                        <div className={`node-badge node-badge--${s}`}>
                          {s === 'done'   ? 'Done'   : s === 'active' ? 'Running' : 'Pending'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <p className="pipeline-status">{statusText}</p>
              </div>
            </div>
          )}

          {/* ══ RESULT ══ */}
          {phase === 'result' && fitData && (
            <div className="center-wrap">
              <div className="light-card result-card anim" style={{ '--delay': '0ms' }}>

                {/* Header */}
                <div className="result-header">
                  <div>
                    <div className="result-eyebrow">Analysis Complete</div>
                    <h1 className="result-title">Job Fit Report</h1>
                  </div>
                  {/* Score block */}
                  <div className="score-block">
                    <span
                      className="score-num"
                      style={{ color: scoreColor(fitData.fit_score) }}
                    >
                      {displayScore}
                    </span>
                    <span className="score-denom">/100</span>
                    <span
                      className="score-badge"
                      style={badgeStyle(fitData.fit_score)}
                    >
                      {fitData.recommendation}
                    </span>
                  </div>
                </div>

                {/* Suggested price */}
                {fitData.suggested_price && (
                  <div className="price-row">
                    <span className="price-label">Suggested Rate</span>
                    <span className="price-value">{fitData.suggested_price}</span>
                  </div>
                )}

                {/* Skills */}
                <div className="skills-grid">
                  <div className="skills-col">
                    <span className="skills-heading skills-heading--match">Matched Skills</span>
                    <div className="skills-list">
                      {fitData.matched_skills?.length
                        ? fitData.matched_skills.map((s, i) => (
                            <span key={i} className="skill-tag skill-tag--match">{s}</span>
                          ))
                        : <span className="skills-empty">None identified</span>
                      }
                    </div>
                  </div>
                  <div className="skills-col">
                    <span className="skills-heading skills-heading--miss">Missing Skills</span>
                    <div className="skills-list">
                      {fitData.missing_skills?.length
                        ? fitData.missing_skills.map((s, i) => (
                            <span key={i} className="skill-tag skill-tag--miss">{s}</span>
                          ))
                        : <span className="skills-empty">None — strong match</span>
                      }
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="result-actions">
                  <button className="btn-secondary" onClick={() => navigate('/new')}>
                    ← Start Over
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => navigate('/generate', { state: { threadId: fitData.thread_id, fitData, form } })}
                  >
                    Generate Proposal →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ ERROR ══ */}
          {phase === 'error' && (
            <div className="center-wrap">
              <div className="dark-card error-card anim" style={{ '--delay': '0ms' }}>
                <p className="error-icon">⚠</p>
                <p className="error-msg">{errorMsg || 'Pipeline failed. Please try again.'}</p>
                <button className="btn-secondary" onClick={() => navigate('/new')}>← Try Again</button>
              </div>
            </div>
          )}

        </main>
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
  .anim {
    opacity: 0;
    animation: fadeUp 400ms ease forwards;
    animation-delay: var(--delay, 0ms);
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
  .nav-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    color: rgba(30,36,25,0.6);
    letter-spacing: -0.01em;
  }
  .status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: dot-blink 1.4s ease-in-out infinite;
  }
  @keyframes dot-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

  .nav-badge-pill {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(30,36,25,0.6);
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    border-radius: 100px;
    padding: 5px 14px;
  }

  /* ── Main ── */
  .ap-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  .center-wrap {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
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

  /* ══════════════════════════
     DARK GLASS CARD (pipeline)
  ══════════════════════════ */
  .dark-card {
    background: var(--glass-dark);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-dark-b);
    border-radius: 20px;
    padding: 32px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .card-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-light-muted);
  }
  .eyebrow-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: dot-blink 1.4s ease-in-out infinite;
  }

  .card-title {
    font-family: var(--font);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: var(--text-light);
    line-height: 1.2;
    margin-top: -12px;
  }

  /* ── Node list ── */
  .node-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 12px;
    transition: background 300ms;
  }
  .node-row--active { background: rgba(122,184,122,0.06); }
  .node-row--done   { background: rgba(255,255,255,0.02); }
  .node-row--idle   { background: transparent; }

  /* Node circle */
  .node-circle {
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 300ms, border-color 300ms;
    position: relative;
  }
  .node-circle--idle {
    border: 1.5px solid rgba(255,255,255,0.1);
    background: transparent;
  }
  .node-circle--active {
    border: 1.5px solid var(--accent);
    background: rgba(122,184,122,0.1);
  }
  .node-circle--active::after {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 1px solid var(--accent);
    opacity: 0.3;
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .node-circle--done {
    border: 1.5px solid var(--accent);
    background: rgba(122,184,122,0.18);
  }

  .nc-check {
    font-size: 14px;
    color: var(--accent);
    font-weight: 600;
  }
  .nc-idle {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
  }
  .nc-active {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse-dot 1.2s ease-in-out infinite;
  }

  @keyframes pulse-ring {
    0%   { transform: scale(1); opacity: 0.4; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(0.65); opacity: 0.5; }
  }

  /* Node info */
  .node-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .node-name {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--text-light);
    transition: opacity 300ms;
  }
  .node-row--idle .node-name { opacity: 0.35; }
  .node-sub {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.01em;
    color: var(--text-light-muted);
    transition: opacity 300ms;
  }
  .node-row--idle .node-sub { opacity: 0.35; }

  /* Node badge */
  .node-badge {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 100px;
    padding: 4px 10px;
  }
  .node-badge--idle {
    color: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .node-badge--active {
    color: var(--accent);
    background: rgba(122,184,122,0.12);
    border: 1px solid rgba(122,184,122,0.25);
  }
  .node-badge--done {
    color: rgba(122,184,122,0.7);
    background: rgba(122,184,122,0.08);
    border: 1px solid rgba(122,184,122,0.15);
  }

  .pipeline-status {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: var(--text-light-muted);
    animation: blink-text 2s ease-in-out infinite;
  }
  @keyframes blink-text { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }

  /* ══════════════════════════
     LIGHT GLASS CARD (result)
  ══════════════════════════ */
  .light-card {
    background: var(--glass-light);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-light-b);
    border-radius: 20px;
    padding: 32px 36px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .result-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .result-eyebrow {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .result-title {
    font-family: var(--font);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: var(--text-dark);
    line-height: 1.1;
  }

  /* Score block */
  .score-block {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .score-num {
    font-family: var(--font);
    font-size: 56px;
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1;
    transition: color 400ms;
  }
  .score-denom {
    font-family: var(--font);
    font-size: 18px;
    font-weight: 400;
    color: var(--text-muted);
    letter-spacing: -0.01em;
    margin-right: 12px;
    align-self: flex-end;
    margin-bottom: 4px;
  }
  .score-badge {
    align-self: flex-end;
    margin-bottom: 6px;
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 100px;
    padding: 5px 12px;
  }

  /* Price row */
  .price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    border-top: 1px solid rgba(30,36,25,0.08);
    border-bottom: 1px solid rgba(30,36,25,0.08);
  }
  .price-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .price-value {
    font-family: var(--font);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-dark);
  }

  /* Skills */
  .skills-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .skills-col { display: flex; flex-direction: column; gap: 10px; }
  .skills-heading {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .skills-heading--match { color: rgba(28,110,28,0.9); }
  .skills-heading--miss  { color: rgba(30,36,25,0.65); }

  .skills-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill-tag {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 400;
    letter-spacing: -0.005em;
    padding: 4px 12px;
    border-radius: 100px;
  }
  .skill-tag--match {
    background: rgba(122,184,122,0.15);
    color: rgba(60,140,60,0.9);
    border: 1px solid rgba(122,184,122,0.25);
  }
  .skill-tag--miss {
    background: rgba(255,255,255,0.35);
    color: rgba(30,36,25,0.6);
    border: 1px solid rgba(30,36,25,0.12);
  }
  .skills-empty {
    font-family: var(--font);
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.6;
  }

  /* Actions */
  .result-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ── Error card ── */
  .error-card {
    align-items: center;
    text-align: center;
  }
  .error-icon {
    font-size: 32px;
    opacity: 0.7;
    color: rgba(200,80,80,0.8);
  }
  .error-msg {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: var(--text-light-muted);
    max-width: 380px;
    line-height: 1.6;
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .nav { padding: 16px 20px; }

    .ap-main { padding: 24px 16px; align-items: flex-start; }

    .dark-card, .light-card { padding: 24px 20px; gap: 20px; }

    .result-header { flex-direction: column; }
    .score-num { font-size: 44px; }

    .skills-grid { grid-template-columns: 1fr; gap: 16px; }

    .result-actions { flex-direction: column-reverse; align-items: stretch; }
    .btn-secondary, .btn-primary { text-align: center; }
  }
`
