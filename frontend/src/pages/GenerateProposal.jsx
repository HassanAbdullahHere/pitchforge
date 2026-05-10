import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NODES = [
  { key: 'generator',        label: 'Drafting',   sub: 'proposal' },
  { key: 'critic',           label: 'Critiquing', sub: 'draft quality' },
  { key: 'human_checkpoint', label: 'Reviewing',  sub: 'awaiting input' },
  { key: 'compiler',         label: 'Compiling',  sub: 'final proposal' },
]

const INIT_NODES = Object.fromEntries(NODES.map(n => [n.key, 'idle']))

async function readSSE(url, payload, onEvent, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
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
      onEvent(ev, data)
    }
  }
}

export default function GenerateProposal() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const threadId = state?.threadId

  const [phase, setPhase] = useState('generating')
  const [nodeStates, setNodeStates] = useState(INIT_NODES)
  const [proposalText, setProposalText] = useState('')
  const [statusText, setStatusText] = useState('Initializing generator…')
  const [quality, setQuality] = useState(null)
  const [finalProposal, setFinalProposal] = useState('')
  const [revisionInput, setRevisionInput] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [copied, setCopied] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const ctrlRef = useRef(null)
  const draftRef = useRef(null)

  useEffect(() => {
    if (draftRef.current) {
      draftRef.current.scrollTop = draftRef.current.scrollHeight
    }
  }, [proposalText])

  const handleEvents = (ev, data) => {
    if (ev === 'node_start') {
      setNodeStates(p => ({ ...p, [data.node]: 'active' }))
      setStatusText(data.label + '…')
    } else if (ev === 'node_complete') {
      setNodeStates(p => ({ ...p, [data.node]: 'done' }))
    } else if (ev === 'token') {
      setProposalText(p => p + data.token)
    } else if (ev === 'done' && data.proposal_draft !== undefined) {
      setQuality({
        score: data.quality_score,
        feedback: data.critic_feedback,
        iterationCount: data.iteration_count,
      })
      setPhase('reviewing')
    } else if (ev === 'error') {
      setErrorMsg(data.message)
      setPhase('error')
    }
  }

  const startStream = async (url, payload) => {
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    try {
      await readSSE(url, payload, handleEvents, ctrl.signal)
    } catch (err) {
      if (err.name === 'AbortError') return
      setErrorMsg(err.message || 'Something went wrong')
      setPhase('error')
    }
  }

  useEffect(() => {
    if (!threadId) { navigate('/new', { replace: true }); return }
    startStream('/api/proposal/generate', { thread_id: threadId, should_apply: true })
    return () => ctrlRef.current?.abort()
  }, [])

  const submitRevision = () => {
    if (!revisionInput.trim()) return
    const instruction = revisionInput
    setRevisionInput('')
    setPhase('generating')
    setNodeStates(INIT_NODES)
    setProposalText('')
    setStatusText('Applying revision…')
    setFeedbackOpen(false)
    startStream('/api/proposal/revise', { thread_id: threadId, instruction })
  }

  const doFinalize = async () => {
    setPhase('finalizing')
    try {
      const res = await fetch('/api/proposal/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId }),
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
            if (line.startsWith('data: ')) { try { data = JSON.parse(line.slice(6)) } catch {} }
          }
          if (!data) continue
          if (ev === 'done') {
            setFinalProposal(data.final_proposal || proposalText)
            setPhase('final')
          } else if (ev === 'error') {
            setErrorMsg(data.message)
            setPhase('error')
          }
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to finalize proposal')
      setPhase('error')
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalProposal).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const qualityColor = s => s >= 70 ? 'var(--gold)' : s >= 40 ? 'var(--fire)' : '#e74c3c'
  const qualityBadgeClass = s => s >= 70 ? 'badge--green' : s >= 40 ? 'badge--amber' : 'badge--red'
  const qualityLabel = s => s >= 70 ? 'High Quality' : s >= 40 ? 'Good Draft' : 'Needs Work'

  return (
    <>
      <style>{css}</style>
      <div className="gp-page">
        <div className="bg-grid" />
        <div className="bg-vignette" />
        <div className="bg-grain" />

        <nav className="nav">
          <button className="nav-wordmark" onClick={() => navigate('/')}>
            <span className="nav-pitch">Pitch</span><span className="nav-forge">Forge</span>
          </button>
          {phase === 'generating' && (
            <span className="nav-status">
              <span className="nav-status-dot" />
              Generating proposal
            </span>
          )}
          {(phase === 'reviewing' || phase === 'revising') && (
            <span className="nav-phase-label">Review</span>
          )}
          {phase === 'final' && (
            <span className="nav-phase-label">Final</span>
          )}
        </nav>

        <main className="gp-main">

          {/* ── GENERATING ── */}
          {phase === 'generating' && (
            <div className="gen-layout">
              <div className="pipeline-panel">
                <p className="panel-eyebrow">Pipeline</p>
                <div className="pipeline-vert">
                  {NODES.map((node, i) => {
                    const s = nodeStates[node.key]
                    return (
                      <div key={node.key} className="pipeline-row">
                        {i > 0 && (
                          <div className={`conn-v${s === 'active' ? ' conn-v--active' : s === 'done' ? ' conn-v--done' : ''}`} />
                        )}
                        <div className="pip-item">
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

              <div className="draft-panel">
                <p className="panel-eyebrow">Draft</p>
                <div className="draft-scroll" ref={draftRef}>
                  {proposalText
                    ? <pre className="draft-text">{proposalText}<span className="draft-cursor" /></pre>
                    : <p className="draft-placeholder">Drafting your proposal…</p>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── REVIEWING / REVISING ── */}
          {(phase === 'reviewing' || phase === 'revising') && (
            <div className="review-layout">
              <div className="review-header">
                <div>
                  <p className="result-eyebrow">Proposal Ready</p>
                  <h1 className="result-title">Review Your Draft</h1>
                </div>
                {quality && (
                  <div className="quality-block">
                    <span className="quality-num" style={{ color: qualityColor(quality.score) }}>
                      {quality.score}
                    </span>
                    <div className="quality-meta">
                      <span className="quality-lbl">quality score</span>
                      <span className={`badge ${qualityBadgeClass(quality.score)}`}>
                        {qualityLabel(quality.score)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="proposal-card">
                <pre className="proposal-text">{proposalText}</pre>
              </div>

              {quality?.feedback && (
                <div className="feedback-section">
                  <button className="feedback-toggle" onClick={() => setFeedbackOpen(o => !o)}>
                    <span>AI Critique</span>
                    <span className={`chevron${feedbackOpen ? ' chevron--open' : ''}`}>▾</span>
                  </button>
                  {feedbackOpen && <p className="feedback-body">{quality.feedback}</p>}
                </div>
              )}

              {phase === 'revising' && (
                <div className="revision-panel">
                  <p className="revision-lbl">Describe your changes</p>
                  <textarea
                    className="revision-input"
                    placeholder="e.g. Make the opening stronger, add a closing question, emphasize React experience…"
                    value={revisionInput}
                    onChange={e => setRevisionInput(e.target.value)}
                    rows={4}
                    autoFocus
                  />
                  <div className="rev-actions">
                    <button className="secondary-btn" onClick={() => setPhase('reviewing')}>
                      Cancel
                    </button>
                    <button
                      className="primary-btn"
                      onClick={submitRevision}
                      disabled={!revisionInput.trim()}
                    >
                      <span className="primary-btn-text">Submit Revision</span>
                      <span className="primary-btn-arrow">→</span>
                      <span className="primary-btn-glow" />
                    </button>
                  </div>
                </div>
              )}

              {phase === 'reviewing' && (
                <div className="review-actions">
                  <button className="secondary-btn" onClick={() => setPhase('revising')}>
                    Request Revision
                  </button>
                  <button className="primary-btn" onClick={doFinalize}>
                    <span className="primary-btn-text">Approve Proposal</span>
                    <span className="primary-btn-arrow">→</span>
                    <span className="primary-btn-glow" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── FINALIZING ── */}
          {phase === 'finalizing' && (
            <div className="finalizing-wrap">
              <div className="fin-spinner" />
              <p className="fin-text">Compiling your proposal…</p>
            </div>
          )}

          {/* ── FINAL ── */}
          {phase === 'final' && (
            <div className="final-layout">
              <div className="final-header">
                <p className="result-eyebrow">Complete</p>
                <h1 className="result-title">Your Proposal</h1>
              </div>
              <div className="proposal-card final-card">
                <pre className="proposal-text">{finalProposal}</pre>
              </div>
              <div className="final-actions">
                <button className="secondary-btn" onClick={() => navigate('/new')}>
                  ← Start New Proposal
                </button>
                <button className="primary-btn" onClick={copyToClipboard}>
                  <span className="primary-btn-text">{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  <span className="primary-btn-glow" />
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {phase === 'error' && (
            <div className="error-wrap">
              <p className="error-icon">⚠</p>
              <p className="error-msg">{errorMsg || 'Something went wrong. Please try again.'}</p>
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

  .gp-page {
    position: relative;
    min-height: 100vh; height: 100vh;
    background: var(--bg);
    display: flex; flex-direction: column;
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
    flex-shrink: 0;
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
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--ivory-dim);
  }
  .nav-status-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--gold);
    animation: dot-blink 1.4s ease-in-out infinite;
  }
  .nav-phase-label {
    font-family: var(--font-mono); font-size: 0.62rem;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--ivory-dim);
  }

  /* ── Main ── */
  .gp-main {
    position: relative; z-index: 10;
    flex: 1; display: flex;
    overflow: hidden;
  }

  /* ══════════════════════════════
     GENERATING PHASE
  ══════════════════════════════ */

  .gen-layout {
    display: flex; flex: 1; overflow: hidden;
    animation: fade-up 0.6s ease both;
  }

  .pipeline-panel {
    width: 260px; flex-shrink: 0;
    display: flex; flex-direction: column;
    padding: 2.5rem 2rem 2rem;
    border-right: 1px solid rgba(201,168,76,0.08);
    gap: 1.5rem;
  }

  .panel-eyebrow {
    font-family: var(--font-mono); font-size: 0.62rem;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold); opacity: 0.6;
  }

  .pipeline-vert {
    display: flex; flex-direction: column;
    flex: 1;
  }

  .pipeline-row {
    display: flex; flex-direction: column;
    align-items: flex-start;
  }

  .conn-v {
    width: 1px; height: 36px;
    background: rgba(138,109,46,0.3);
    margin-left: 27px;
    position: relative; overflow: hidden;
  }
  .conn-v--active::after {
    content: '';
    position: absolute; top: -100%; left: 0; right: 0;
    height: 100%;
    background: linear-gradient(180deg, transparent, var(--gold), transparent);
    animation: shimmer-v 1.2s linear infinite;
  }
  .conn-v--done { background: var(--gold-dim); }

  .pip-item {
    display: flex; align-items: center; gap: 0.85rem;
  }

  .pipeline-status {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.1em; color: var(--ivory-dim);
    animation: blink-text 2s ease-in-out infinite;
  }

  /* ── Draft panel ── */
  .draft-panel {
    flex: 1; display: flex; flex-direction: column;
    padding: 2.5rem 2.5rem 2rem;
    gap: 1rem;
    overflow: hidden;
  }

  .draft-scroll {
    flex: 1; overflow-y: auto;
    border: 1px solid rgba(201,168,76,0.08);
    padding: 1.75rem 2rem;
  }
  .draft-scroll::-webkit-scrollbar { width: 4px; }
  .draft-scroll::-webkit-scrollbar-track { background: transparent; }
  .draft-scroll::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 2px; }

  .draft-text {
    font-family: var(--font-display); font-size: 1rem;
    line-height: 1.85; color: var(--ivory); font-weight: 300;
    white-space: pre-wrap; word-break: break-word;
  }
  .draft-cursor {
    display: inline-block;
    width: 2px; height: 1.1em;
    background: var(--gold);
    margin-left: 2px; vertical-align: text-bottom;
    animation: cursor-blink 0.9s ease-in-out infinite;
  }
  .draft-placeholder {
    font-family: var(--font-mono); font-size: 0.7rem;
    letter-spacing: 0.1em; color: var(--ivory-dim); opacity: 0.4;
    animation: blink-text 2s ease-in-out infinite;
  }

  /* ── Node circles (same as AnalyzePipeline) ── */
  .node {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.4s, border-color 0.4s;
    position: relative; flex-shrink: 0;
  }
  .node--idle { border: 1px solid rgba(138,109,46,0.3); background: transparent; }
  .node-idle { width: 8px; height: 8px; border-radius: 50%; background: rgba(138,109,46,0.4); }
  .node--active { border: 1px solid var(--gold); background: rgba(201,168,76,0.08); }
  .node--active::before {
    content: ''; position: absolute; inset: -4px; border-radius: 50%;
    border: 1px solid var(--gold); opacity: 0.4;
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .node--active::after {
    content: ''; position: absolute; inset: -9px; border-radius: 50%;
    border: 1px solid var(--gold); opacity: 0.15;
    animation: pulse-ring 1.5s ease-out 0.3s infinite;
  }
  .node-pulse {
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--gold);
    animation: pulse-dot 1.2s ease-in-out infinite;
  }
  .node--done { border: 1px solid var(--gold); background: var(--gold); }
  .node-icon { color: var(--bg); font-weight: 700; font-size: 1.1rem; font-family: var(--font-mono); }
  .node-labels { display: flex; flex-direction: column; gap: 0.15rem; }
  .node-main {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--ivory-dim);
    transition: color 0.3s;
  }
  .pip-item:has(.node--active) .node-main { color: var(--gold); }
  .pip-item:has(.node--done)   .node-main { color: var(--ivory); }
  .node-sub {
    font-family: var(--font-mono); font-size: 0.55rem;
    letter-spacing: 0.08em; color: var(--ivory-dim); opacity: 0.5;
  }
  .pip-item:has(.node--active) .node-sub { opacity: 0.8; }
  .pip-item:has(.node--done)   .node-sub { opacity: 0.6; }

  /* ══════════════════════════════
     REVIEW / REVISE PHASE
  ══════════════════════════════ */

  .review-layout {
    flex: 1; display: flex; flex-direction: column;
    align-items: center;
    padding: 2.5rem 2rem 2rem;
    gap: 1.75rem;
    overflow-y: auto;
    animation: fade-up 0.6s ease both;
  }
  .review-layout::-webkit-scrollbar { width: 4px; }
  .review-layout::-webkit-scrollbar-track { background: transparent; }
  .review-layout::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.15); border-radius: 2px; }

  .review-header {
    width: 100%; max-width: 780px;
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 1.5rem;
    flex-wrap: wrap;
  }

  .result-eyebrow {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold); opacity: 0.7;
    margin-bottom: 0.3rem;
  }
  .result-title {
    font-family: var(--font-display); font-size: 2.8rem;
    font-weight: 300; font-style: italic; color: var(--ivory);
  }

  .quality-block {
    display: flex; align-items: center; gap: 1rem; flex-shrink: 0;
  }
  .quality-num {
    font-family: var(--font-display); font-size: 3.2rem;
    font-weight: 600; line-height: 1;
    transition: color 0.4s;
  }
  .quality-meta { display: flex; flex-direction: column; gap: 0.45rem; }
  .quality-lbl {
    font-family: var(--font-mono); font-size: 0.58rem;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--ivory-dim);
  }

  /* ── Proposal card ── */
  .proposal-card {
    width: 100%; max-width: 780px;
    border: 1px solid rgba(201,168,76,0.1);
    max-height: 48vh; overflow-y: auto;
    padding: 2rem 2.25rem;
    background: rgba(255,255,255,0.01);
  }
  .proposal-card::-webkit-scrollbar { width: 4px; }
  .proposal-card::-webkit-scrollbar-track { background: transparent; }
  .proposal-card::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 2px; }

  .proposal-text {
    font-family: var(--font-display); font-size: 1.05rem;
    line-height: 1.9; color: var(--ivory); font-weight: 300;
    white-space: pre-wrap; word-break: break-word;
  }

  /* ── Critic feedback ── */
  .feedback-section {
    width: 100%; max-width: 780px;
    border: 1px solid rgba(201,168,76,0.08);
    overflow: hidden;
  }
  .feedback-toggle {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    padding: 0.85rem 1.25rem;
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ivory-dim); background: rgba(201,168,76,0.02);
    border: none; cursor: pointer;
    transition: color 0.2s, background 0.2s;
  }
  .feedback-toggle:hover { color: var(--ivory); background: rgba(201,168,76,0.05); }
  .chevron { transition: transform 0.25s ease; display: inline-block; }
  .chevron--open { transform: rotate(180deg); }
  .feedback-body {
    padding: 1.1rem 1.25rem 1.4rem;
    font-family: var(--font-display); font-size: 0.95rem;
    line-height: 1.8; color: var(--ivory-dim); font-weight: 300;
    border-top: 1px solid rgba(201,168,76,0.07);
  }

  /* ── Revision panel ── */
  .revision-panel {
    width: 100%; max-width: 780px;
    display: flex; flex-direction: column; gap: 1rem;
    border: 1px solid rgba(201,168,76,0.14);
    padding: 1.5rem 1.75rem;
    background: rgba(201,168,76,0.015);
    animation: fade-up 0.35s ease both;
  }
  .revision-lbl {
    font-family: var(--font-mono); font-size: 0.65rem;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--gold); opacity: 0.85;
  }
  .revision-input {
    width: 100%; resize: vertical; background: transparent;
    border: none; border-bottom: 1px solid rgba(138,109,46,0.4);
    padding: 0.5rem 0;
    font-family: var(--font-display); font-size: 1rem;
    line-height: 1.7; color: var(--ivory); font-weight: 300;
    outline: none; transition: border-color 0.2s;
  }
  .revision-input::placeholder { color: var(--ivory-dim); opacity: 0.4; }
  .revision-input:focus { border-bottom-color: var(--gold); }
  .rev-actions {
    display: flex; align-items: center; justify-content: flex-end; gap: 1rem;
    flex-wrap: wrap;
  }

  /* ── Action bars ── */
  .review-actions {
    width: 100%; max-width: 780px;
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    flex-wrap: wrap;
  }

  /* ══════════════════════════════
     FINALIZING PHASE
  ══════════════════════════════ */

  .finalizing-wrap {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2rem;
    animation: fade-up 0.5s ease both;
  }
  .fin-spinner {
    width: 48px; height: 48px; border-radius: 50%;
    border: 2px solid rgba(201,168,76,0.15);
    border-top-color: var(--gold);
    animation: spin 1s linear infinite;
  }
  .fin-text {
    font-family: var(--font-mono); font-size: 0.75rem;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--ivory-dim);
    animation: blink-text 2s ease-in-out infinite;
  }

  /* ══════════════════════════════
     FINAL PHASE
  ══════════════════════════════ */

  .final-layout {
    flex: 1; display: flex; flex-direction: column;
    align-items: center;
    padding: 2.5rem 2rem 2rem;
    gap: 1.75rem;
    overflow-y: auto;
    animation: fade-up 0.7s ease both;
  }
  .final-layout::-webkit-scrollbar { width: 4px; }
  .final-layout::-webkit-scrollbar-track { background: transparent; }
  .final-layout::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.15); border-radius: 2px; }

  .final-header { width: 100%; max-width: 780px; }
  .final-card { max-height: 60vh; }
  .final-actions {
    width: 100%; max-width: 780px;
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    flex-wrap: wrap;
  }

  /* ══════════════════════════════
     ERROR PHASE
  ══════════════════════════════ */

  .error-wrap {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 1.5rem;
    text-align: center;
    animation: fade-up 0.6s ease both;
  }
  .error-icon { font-size: 2.5rem; color: var(--fire); opacity: 0.8; }
  .error-msg {
    font-family: var(--font-mono); font-size: 0.8rem;
    letter-spacing: 0.06em; color: var(--ivory-dim);
    max-width: 420px; line-height: 1.8;
  }

  /* ── Badges ── */
  .badge {
    font-family: var(--font-mono); font-size: 0.62rem;
    letter-spacing: 0.16em; text-transform: uppercase;
    padding: 0.3rem 0.9rem;
    clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
  }
  .badge--green { background: rgba(201,168,76,0.15); color: var(--gold); border: 1px solid rgba(201,168,76,0.3); }
  .badge--amber { background: rgba(232,121,58,0.12); color: var(--fire); border: 1px solid rgba(232,121,58,0.3); }
  .badge--red   { background: rgba(192,57,43,0.12);  color: #e74c3c;    border: 1px solid rgba(192,57,43,0.3); }

  /* ── Buttons ── */
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
    transition: color 0.3s, border-color 0.3s;
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
  }
  .primary-btn::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(201,168,76,0.14), rgba(232,121,58,0.08));
    opacity: 0; transition: opacity 0.3s;
  }
  .primary-btn:hover:not(:disabled) { border-color: var(--gold); color: var(--gold); }
  .primary-btn:hover:not(:disabled)::before { opacity: 1; }
  .primary-btn:hover:not(:disabled) .primary-btn-glow { opacity: 1; }
  .primary-btn:hover:not(:disabled) .primary-btn-arrow { transform: translateX(4px); }
  .primary-btn:disabled { opacity: 0.38; cursor: not-allowed; }
  .primary-btn-text { position: relative; z-index: 1; }
  .primary-btn-arrow { position: relative; z-index: 1; font-size: 1rem; transition: transform 0.3s; }
  .primary-btn-glow {
    position: absolute; inset: -2px;
    box-shadow: 0 0 24px 4px rgba(201,168,76,0.25), 0 0 50px 8px rgba(232,121,58,0.1);
    opacity: 0; transition: opacity 0.4s; pointer-events: none;
  }

  /* ── Keyframes ── */
  @keyframes fade-up    { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dot-blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
  @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.5); opacity: 0; } }
  @keyframes pulse-dot  { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.7); opacity: 0.5; } }
  @keyframes shimmer-v  { from { top: -100%; } to { top: 100%; } }
  @keyframes blink-text { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
  @keyframes spin        { to { transform: rotate(360deg); } }
  @keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .nav { padding: 1.25rem; }
    .nav-wordmark { font-size: 1.2rem; }

    .gen-layout { flex-direction: column; overflow-y: auto; }

    .pipeline-panel {
      width: 100%; border-right: none;
      border-bottom: 1px solid rgba(201,168,76,0.08);
      padding: 1.5rem 1.25rem; gap: 1rem;
      flex-direction: row; align-items: center; flex-wrap: wrap;
    }
    .panel-eyebrow { display: none; }
    .pipeline-vert { flex-direction: row; flex-wrap: wrap; gap: 0.5rem; flex: 1; }
    .pipeline-row { flex-direction: row; align-items: center; }
    .conn-v { display: none; }
    .node { width: 40px; height: 40px; }
    .node-sub { display: none; }
    .pipeline-status { font-size: 0.6rem; flex-shrink: 0; }

    .draft-panel { padding: 1.25rem; flex: 1; min-height: 0; }
    .draft-panel .panel-eyebrow { display: none; }

    .review-layout,
    .final-layout { padding: 1.5rem 1.25rem; gap: 1.25rem; }
    .result-title  { font-size: 2rem; }
    .review-header { flex-direction: column; gap: 1rem; }
    .proposal-card { max-height: 38vh; padding: 1.25rem; }
    .final-card    { max-height: 45vh; }
    .review-actions,
    .final-actions { flex-direction: column-reverse; align-items: stretch; }
    .rev-actions   { flex-direction: column-reverse; align-items: stretch; }
    .secondary-btn { text-align: center; }
    .primary-btn   { justify-content: center; }
  }
`
