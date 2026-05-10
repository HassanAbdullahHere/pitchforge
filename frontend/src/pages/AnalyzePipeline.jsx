import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

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

  const [nodeStates, setNodeStates] = useState(INIT_STATES)
  const [phase, setPhase] = useState('streaming')
  const [fitData, setFitData] = useState(null)
  const [statusText, setStatusText] = useState('Connecting to pipeline…')
  const [errorMsg, setErrorMsg] = useState(null)
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

  const scoreColor = s => s >= 70 ? '#c9a84c' : s >= 40 ? '#e8793a' : '#c0392b'
  const badgeClass = s => s >= 70 ? 'badge--green' : s >= 40 ? 'badge--amber' : 'badge--red'

  return (
    <>
      <style>{css}</style>
      <div className="ap-page">
        <div className="bg-grid" />
        <div className="bg-vignette" />
        <div className="bg-grain" />

        <nav className="nav">
          <button className="nav-wordmark" onClick={() => navigate('/')}>
            <span className="nav-pitch">Pitch</span><span className="nav-forge">Forge</span>
          </button>
          {phase === 'streaming' && (
            <span className="nav-status">
              <span className="nav-status-dot" />
              Running pipeline
            </span>
          )}
        </nav>

        <main className="ap-main">

          {/* ── STREAMING ── */}
          {phase === 'streaming' && (
            <div className="pipeline-wrap">
              <p className="pipeline-eyebrow">Analyzing your job posting</p>
              <h1 className="pipeline-title">Pipeline Running</h1>

              <div className="pipeline">
                {NODES.map((node, i) => {
                  const s = nodeStates[node.key]
                  const prevDone = i > 0 && nodeStates[NODES[i - 1].key] === 'done'
                  return (
                    <div key={node.key} className="pipeline-track">
                      {i > 0 && (
                        <div className={`connector${s === 'active' ? ' connector--active' : s === 'done' ? ' connector--done' : ''}`} />
                      )}
                      <div className="pipeline-item">
                        <div className={`node node--${s}`}>
                          {s === 'done'   && <span className="node-icon">✓</span>}
                          {s === 'active' && <span className="node-pulse" />}
                          {s === 'idle'   && <span className="node-idle" />}
                        </div>
                        <div className="node-labels">
                          <span className="node-main">{node.label}</span>
                          <span className="node-sub">{node.sub}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="pipeline-status">{statusText}</p>
            </div>
          )}

          {/* ── RESULT ── */}
          {phase === 'result' && fitData && (
            <div className="result-card">
              <div className="result-header">
                <p className="result-eyebrow">Analysis Complete</p>
                <h1 className="result-title">Job Fit Report</h1>
              </div>

              {/* Score gauge */}
              <div className="score-block">
                <span className="score-label">Fit Score</span>
                <div
                  className="score-meter-wrap"
                  style={{ filter: `drop-shadow(0 0 22px ${scoreColor(fitData.fit_score)}55)` }}
                >
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    {/* background track */}
                    <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(201,168,76,0.08)" strokeWidth="7" />
                    {/* tick marks */}
                    {Array.from({ length: 10 }).map((_, i) => {
                      const angle = (i / 10) * 2 * Math.PI - Math.PI / 2
                      const inner = 78, outer = 84
                      return (
                        <line key={i}
                          x1={100 + inner * Math.cos(angle)} y1={100 + inner * Math.sin(angle)}
                          x2={100 + outer * Math.cos(angle)} y2={100 + outer * Math.sin(angle)}
                          stroke="rgba(201,168,76,0.2)" strokeWidth="1"
                        />
                      )
                    })}
                    {/* animated arc */}
                    <circle
                      cx="100" cy="100" r="70"
                      fill="none"
                      stroke={scoreColor(fitData.fit_score)}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={meterOffset}
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px' }}
                    />
                    {/* score number */}
                    <text
                      x="100" y="88"
                      textAnchor="middle" dominantBaseline="middle"
                      fill={scoreColor(fitData.fit_score)}
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '52px', fontWeight: 600 }}
                    >
                      {displayScore}
                    </text>
                    <text
                      x="100" y="122"
                      textAnchor="middle"
                      fill="rgba(245,240,232,0.35)"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', letterSpacing: '2px' }}
                    >
                      OUT OF 100
                    </text>
                  </svg>
                </div>
                <span className={`badge ${badgeClass(fitData.fit_score)}`}>
                  {fitData.recommendation}
                </span>
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
                  <span className="skills-heading match-heading">Matched Skills</span>
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
                  <span className="skills-heading miss-heading">Missing Skills</span>
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
                <button className="secondary-btn" onClick={() => navigate('/new')}>
                  ← Start Over
                </button>
                <button
                  className="primary-btn"
                  onClick={() => navigate('/generate', { state: { threadId: fitData.thread_id } })}
                >
                  <span className="primary-btn-text">Generate Proposal</span>
                  <span className="primary-btn-arrow">→</span>
                  <span className="primary-btn-glow" />
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {phase === 'error' && (
            <div className="error-wrap">
              <p className="error-icon">⚠</p>
              <p className="error-msg">{errorMsg || 'Pipeline failed. Please try again.'}</p>
              <button className="secondary-btn" onClick={() => navigate('/new')}>← Try Again</button>
            </div>
          )}

        </main>
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

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .ap-page {
    position: relative;
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Background layers ── */
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

  /* ── Nav ── */
  .nav {
    position: relative; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.75rem 3rem;
    border-bottom: 1px solid rgba(201,168,76,0.08);
    animation: fade-up 0.5s ease both;
  }
  .nav-wordmark {
    font-family: var(--font-display); font-size: 1.5rem; font-weight: 500;
    letter-spacing: 0.06em; background: none; border: none; cursor: pointer; padding: 0;
  }
  .nav-pitch { color: var(--ivory); }
  .nav-forge { color: var(--gold); }

  .nav-status {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-family: var(--font-mono); font-size: 0.62rem;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--ivory-dim);
  }
  .nav-status-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--gold);
    animation: dot-blink 1.4s ease-in-out infinite;
  }
  @keyframes dot-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }

  /* ── Main ── */
  .ap-main {
    position: relative; z-index: 10;
    flex: 1; display: flex;
    align-items: center; justify-content: center;
    padding: 3rem 2rem;
  }

  /* ══════════════════════════════
     STREAMING PHASE
  ══════════════════════════════ */

  .pipeline-wrap {
    display: flex; flex-direction: column;
    align-items: center; gap: 2rem;
    animation: fade-up 0.6s ease both;
  }

  .pipeline-eyebrow {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold); opacity: 0.7;
  }

  .pipeline-title {
    font-family: var(--font-display); font-size: 2.8rem;
    font-weight: 300; font-style: italic;
    color: var(--ivory); text-align: center;
  }

  .pipeline {
    display: flex; align-items: flex-start;
    gap: 0; margin: 1rem 0;
  }

  .pipeline-track {
    display: flex; align-items: center;
  }

  /* connector line between nodes */
  .connector {
    width: 60px; height: 1px;
    background: rgba(138,109,46,0.3);
    position: relative; overflow: hidden;
    flex-shrink: 0;
  }
  .connector--active::after {
    content: '';
    position: absolute; top: 0; left: -100%; bottom: 0;
    width: 100%;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    animation: shimmer 1.2s linear infinite;
  }
  .connector--done {
    background: var(--gold-dim);
  }
  @keyframes shimmer {
    from { left: -100%; }
    to   { left: 100%; }
  }

  .pipeline-item {
    display: flex; flex-direction: column;
    align-items: center; gap: 0.75rem;
  }

  /* ── Node circle ── */
  .node {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.4s ease, border-color 0.4s ease;
    position: relative;
  }

  .node--idle {
    border: 1px solid rgba(138,109,46,0.3);
    background: transparent;
  }
  .node-idle {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(138,109,46,0.4);
  }

  .node--active {
    border: 1px solid var(--gold);
    background: rgba(201,168,76,0.08);
  }
  .node--active::before {
    content: '';
    position: absolute; inset: -4px; border-radius: 50%;
    border: 1px solid var(--gold);
    opacity: 0.4;
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .node--active::after {
    content: '';
    position: absolute; inset: -9px; border-radius: 50%;
    border: 1px solid var(--gold);
    opacity: 0.15;
    animation: pulse-ring 1.5s ease-out 0.3s infinite;
  }
  .node-pulse {
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--gold);
    animation: pulse-dot 1.2s ease-in-out infinite;
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1); opacity: 0.4; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(0.7); opacity: 0.5; }
  }

  .node--done {
    border: 1px solid var(--gold);
    background: var(--gold);
  }
  .node-icon {
    color: var(--bg); font-weight: 700; font-size: 1.1rem;
    font-family: var(--font-mono);
  }

  /* ── Node labels ── */
  .node-labels {
    display: flex; flex-direction: column;
    align-items: center; gap: 0.15rem;
    text-align: center;
  }
  .node-main {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ivory-dim);
    transition: color 0.3s;
  }
  .node--active ~ .node-labels .node-main,
  .node-labels:has(~ .node--active) .node-main { color: var(--gold); }

  .pipeline-item:has(.node--active) .node-main { color: var(--gold); }
  .pipeline-item:has(.node--done)   .node-main { color: var(--ivory); }

  .node-sub {
    font-family: var(--font-mono); font-size: 0.55rem;
    letter-spacing: 0.08em; color: var(--ivory-dim); opacity: 0.5;
  }
  .pipeline-item:has(.node--active) .node-sub { opacity: 0.8; }
  .pipeline-item:has(.node--done)   .node-sub { opacity: 0.6; }

  .pipeline-status {
    font-family: var(--font-mono); font-size: 0.7rem;
    letter-spacing: 0.1em; color: var(--ivory-dim);
    animation: blink-text 2s ease-in-out infinite;
  }
  @keyframes blink-text {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1; }
  }

  /* ══════════════════════════════
     RESULT PHASE
  ══════════════════════════════ */

  .result-card {
    width: 100%; max-width: 680px;
    display: flex; flex-direction: column; gap: 2.5rem;
    animation: fade-up 0.7s ease both;
  }

  .result-header { display: flex; flex-direction: column; gap: 0.4rem; }
  .result-eyebrow {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold); opacity: 0.7;
  }
  .result-title {
    font-family: var(--font-display); font-size: 3rem;
    font-weight: 300; font-style: italic; color: var(--ivory);
  }

  /* ── Score ── */
  .score-block {
    display: flex; flex-direction: column;
    align-items: center; gap: 1.25rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(201,168,76,0.1);
  }
  .score-label {
    font-family: var(--font-mono); font-size: 0.7rem;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ivory-dim);
    align-self: flex-start;
  }
  .score-meter-wrap {
    transition: filter 0.6s ease;
  }

  .badge {
    align-self: flex-start;
    font-family: var(--font-mono); font-size: 0.62rem;
    letter-spacing: 0.16em; text-transform: uppercase;
    padding: 0.3rem 0.9rem;
    clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
  }
  .badge--green { background: rgba(201,168,76,0.15); color: var(--gold); border: 1px solid rgba(201,168,76,0.3); }
  .badge--amber { background: rgba(232,121,58,0.12); color: var(--fire); border: 1px solid rgba(232,121,58,0.3); }
  .badge--red   { background: rgba(192,57,43,0.12);  color: #e74c3c;    border: 1px solid rgba(192,57,43,0.3); }

  /* ── Price ── */
  .price-row {
    display: flex; align-items: baseline; justify-content: space-between;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(201,168,76,0.1);
  }
  .price-label {
    font-family: var(--font-mono); font-size: 0.7rem;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ivory-dim);
  }
  .price-value {
    font-family: var(--font-display); font-size: 1.8rem;
    font-weight: 400; color: var(--gold);
  }

  /* ── Skills ── */
  .skills-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(201,168,76,0.1);
  }
  .skills-col { display: flex; flex-direction: column; gap: 0.75rem; }
  .skills-heading {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.16em; text-transform: uppercase;
  }
  .match-heading { color: var(--gold); }
  .miss-heading  { color: var(--fire); }

  .skills-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .skill-tag {
    font-family: var(--font-mono); font-size: 0.6rem;
    letter-spacing: 0.08em; padding: 0.25rem 0.65rem;
    clip-path: polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%);
  }
  .skill-tag--match {
    background: rgba(201,168,76,0.1); color: var(--gold);
    border: 1px solid rgba(201,168,76,0.25);
  }
  .skill-tag--miss {
    background: rgba(232,121,58,0.08); color: var(--fire);
    border: 1px solid rgba(232,121,58,0.2);
  }
  .skills-empty {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--ivory-dim); opacity: 0.5;
  }

  /* ── Actions ── */
  .result-actions {
    display: flex; align-items: center;
    justify-content: space-between; gap: 1rem;
    flex-wrap: wrap;
  }

  .secondary-btn {
    font-family: var(--font-mono); font-size: 0.72rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ivory-dim); background: transparent;
    border: 1px solid rgba(138,109,46,0.4);
    padding: 0.85rem 1.5rem; cursor: pointer;
    clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
    transition: color 0.2s, border-color 0.2s;
  }
  .secondary-btn:hover { color: var(--ivory); border-color: var(--gold-dim); }

  .primary-btn {
    position: relative; display: inline-flex; align-items: center;
    gap: 0.75rem; padding: 1rem 2.2rem;
    font-family: var(--font-mono); font-size: 0.82rem;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--ivory); background: transparent;
    border: 1px solid var(--gold-dim); cursor: pointer; overflow: hidden;
    transition: color 0.3s ease, border-color 0.3s ease;
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
  }
  .primary-btn::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(201,168,76,0.14), rgba(232,121,58,0.08));
    opacity: 0; transition: opacity 0.3s ease;
  }
  .primary-btn:hover { border-color: var(--gold); color: var(--gold); }
  .primary-btn:hover::before { opacity: 1; }
  .primary-btn:hover .primary-btn-glow { opacity: 1; }
  .primary-btn:hover .primary-btn-arrow { transform: translateX(4px); }
  .primary-btn-text { position: relative; z-index: 1; }
  .primary-btn-arrow {
    position: relative; z-index: 1;
    font-size: 1rem; transition: transform 0.3s ease;
  }
  .primary-btn-glow {
    position: absolute; inset: -2px;
    box-shadow: 0 0 24px 4px rgba(201,168,76,0.25), 0 0 50px 8px rgba(232,121,58,0.1);
    opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
  }

  /* ══════════════════════════════
     ERROR PHASE
  ══════════════════════════════ */

  .error-wrap {
    display: flex; flex-direction: column;
    align-items: center; gap: 1.5rem;
    text-align: center;
    animation: fade-up 0.6s ease both;
  }
  .error-icon {
    font-size: 2.5rem; color: var(--fire); opacity: 0.8;
  }
  .error-msg {
    font-family: var(--font-mono); font-size: 0.8rem;
    letter-spacing: 0.06em; color: var(--ivory-dim);
    max-width: 420px; line-height: 1.8;
  }

  /* ── Shared ── */
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .nav { padding: 1.25rem; }
    .nav-wordmark { font-size: 1.2rem; }

    .ap-main { padding: 2rem 1.25rem; align-items: flex-start; }

    /* Stack pipeline vertically */
    .pipeline { flex-direction: column; align-items: center; gap: 0; }
    .pipeline-track { flex-direction: column; align-items: center; }
    .connector { width: 1px; height: 36px; }
    .connector--active::after {
      top: -100%; left: 0; right: 0; bottom: auto;
      width: 100%; height: 100%;
      background: linear-gradient(180deg, transparent, var(--gold), transparent);
      animation: shimmer-v 1.2s linear infinite;
    }
    @keyframes shimmer-v {
      from { top: -100%; }
      to   { top: 100%; }
    }

    .pipeline-title { font-size: 2rem; }
    .result-title   { font-size: 2.2rem; }
    .score-num      { font-size: 2.8rem; }

    .skills-grid { grid-template-columns: 1fr; gap: 1.5rem; }

    .result-actions { flex-direction: column-reverse; align-items: stretch; }
    .secondary-btn { text-align: center; }
    .primary-btn { justify-content: center; }
  }
`
