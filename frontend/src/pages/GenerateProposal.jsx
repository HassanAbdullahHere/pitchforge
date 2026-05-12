import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'

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
  let doneData = null
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
      if (ev === 'done') doneData = data
      onEvent(ev, data)
    }
  }
  return doneData
}

export default function GenerateProposal() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const threadId = state?.threadId
  const fitData  = state?.fitData
  const form     = state?.form

  const [phase, setPhase]               = useState('generating')
  const [nodeStates, setNodeStates]     = useState(INIT_NODES)
  const [proposalText, setProposalText] = useState('')
  const [statusText, setStatusText]     = useState('Initializing generator…')
  const [quality, setQuality]           = useState(null)
  const [finalProposal, setFinalProposal] = useState('')
  const [revisionInput, setRevisionInput] = useState('')
  const [errorMsg, setErrorMsg]         = useState(null)
  const [copied, setCopied]             = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const ctrlRef  = useRef(null)
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
      if (data.node === 'generator') setProposalText('')
    } else if (ev === 'node_complete') {
      setNodeStates(p => ({ ...p, [data.node]: 'done' }))
    } else if (ev === 'token') {
      setProposalText(p => p + data.token)
    } else if (ev === 'done' && data.proposal_draft !== undefined) {
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
      const doneData = await readSSE(url, payload, handleEvents, ctrl.signal)
      if (doneData?.proposal_draft !== undefined) {
        setQuality({
          score: doneData.quality_score,
          feedback: doneData.critic_feedback,
          iterationCount: doneData.iteration_count,
        })
      }
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

  const downloadTxt = () => {
    const slug = (form?.title || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    const blob = new Blob([finalProposal], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const qualityColor = s => s >= 70 ? '#7ab87a' : s >= 40 ? '#d4a855' : '#e74c3c'
  const qualityBadgeStyle = s => s >= 70
    ? { background: 'rgba(122,184,122,0.15)', color: 'rgba(160,220,160,0.85)', border: '1px solid rgba(122,184,122,0.2)' }
    : s >= 40
    ? { background: 'rgba(212,168,85,0.12)', color: 'rgba(212,168,85,0.9)', border: '1px solid rgba(212,168,85,0.25)' }
    : { background: 'rgba(192,57,43,0.12)', color: '#e74c3c', border: '1px solid rgba(192,57,43,0.3)' }
  const qualityLabel = s => s >= 70 ? 'High Quality' : s >= 40 ? 'Good Draft' : 'Needs Work'

  return (
    <>
      <style>{css}</style>
      <div className="page">

        {/* ── Navbar ── */}
        <nav className="nav">
          <Logo onClick={() => navigate('/')} />
          <div className="nav-phase">
            {phase === 'generating' && (
              <span className="nav-status">
                <span className="status-dot" />
                Generating proposal
              </span>
            )}
            {(phase === 'reviewing' || phase === 'revising') && (
              <span className="nav-label">Review Draft</span>
            )}
            {phase === 'finalizing' && (
              <span className="nav-label">Finalizing…</span>
            )}
            {phase === 'final' && (
              <span className="nav-label">Complete</span>
            )}
          </div>
        </nav>

        <main className="gp-main">

          {/* ══ GENERATING ══ */}
          {phase === 'generating' && (
            <div className="two-col anim" style={{ '--delay': '0ms' }}>

              {/* Dark card — pipeline */}
              <div className="dark-card pipeline-col">
                <div className="card-eyebrow">
                  <span className="eyebrow-dot" />
                  Pipeline
                </div>

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
                          {s === 'done' ? 'Done' : s === 'active' ? 'Running' : 'Pending'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <p className="pipeline-status">{statusText}</p>
              </div>

              {/* Light card — draft stream */}
              <div className="light-card draft-col">
                <div className="draft-header">
                  <span className="card-section-label">Draft</span>
                  {proposalText && (
                    <span className="char-count">{proposalText.length} chars</span>
                  )}
                </div>
                <div className="draft-scroll" ref={draftRef}>
                  {proposalText
                    ? <pre className="draft-text">{proposalText}<span className="draft-cursor" /></pre>
                    : <p className="draft-placeholder">Drafting your proposal…</p>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ══ REVIEWING / REVISING ══ */}
          {(phase === 'reviewing' || phase === 'revising') && (
            <div className="two-col anim" style={{ '--delay': '0ms' }}>

              {/* Light card — proposal text */}
              <div className="light-card proposal-col">
                <div className="proposal-header">
                  <div>
                    <div className="result-eyebrow">Proposal Ready</div>
                    <h2 className="result-title">Review Your Draft</h2>
                  </div>
                  {phase === 'reviewing' && (
                    <button className="btn-primary approve-btn" onClick={doFinalize}>
                      Approve Proposal →
                    </button>
                  )}
                </div>

                <div className="proposal-scroll">
                  <pre className="proposal-text">{proposalText}</pre>
                </div>

                {phase === 'reviewing' && (
                  <div className="proposal-footer">
                    <button className="btn-secondary revise-btn" onClick={() => setPhase('revising')}>
                      ✎ Request Revision
                    </button>
                  </div>
                )}

                {phase === 'revising' && (
                  <div className="revision-panel">
                    <label className="revise-label">Describe your changes</label>
                    <textarea
                      className="revision-input"
                      placeholder="e.g. Make the opening stronger, add a closing question, emphasize React experience…"
                      value={revisionInput}
                      onChange={e => setRevisionInput(e.target.value)}
                      rows={4}
                      autoFocus
                    />
                    <div className="rev-actions">
                      <button className="btn-secondary" onClick={() => setPhase('reviewing')}>Cancel</button>
                      <button
                        className="btn-primary"
                        onClick={submitRevision}
                        disabled={!revisionInput.trim()}
                      >
                        Submit Revision →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dark card — critic / pipeline */}
              <div className="dark-card critique-col">
                {/* Quality score */}
                {quality && (
                  <div className="quality-block">
                    <div className="quality-score-row">
                      <span
                        className="quality-num"
                        style={{ color: qualityColor(quality.score) }}
                      >
                        {quality.score}
                      </span>
                      <div className="quality-meta">
                        <span className="quality-meta-label">Quality Score</span>
                        <span
                          className="quality-badge"
                          style={qualityBadgeStyle(quality.score)}
                        >
                          {qualityLabel(quality.score)}
                        </span>
                      </div>
                    </div>
                    {quality.iterationCount > 0 && (
                      <div className="iter-row">
                        <span className="iter-label">Iterations</span>
                        <span className="iter-val">{quality.iterationCount}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Pipeline progress */}
                <div className="pipeline-mini">
                  <div className="card-eyebrow" style={{ marginBottom: '12px' }}>
                    <span>Pipeline</span>
                  </div>
                  <div className="node-list-mini">
                    {NODES.map((node) => {
                      const s = nodeStates[node.key]
                      return (
                        <div key={node.key} className={`node-mini node-mini--${s}`}>
                          <div className={`node-circle-sm node-circle-sm--${s}`}>
                            {s === 'done'   && <span className="nc-check-sm">✓</span>}
                            {s === 'active' && <span className="nc-active-sm" />}
                          </div>
                          <span className="node-mini-name">{node.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI Critique */}
                {quality?.feedback && (
                  <div className="critique-section">
                    <button className="critique-toggle" onClick={() => setFeedbackOpen(o => !o)}>
                      <span className="card-eyebrow" style={{ margin: 0 }}>AI Critique</span>
                      <span className={`chevron${feedbackOpen ? ' chevron--open' : ''}`}>▾</span>
                    </button>
                    {feedbackOpen && (
                      <p className="critique-body">{quality.feedback}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ FINALIZING ══ */}
          {phase === 'finalizing' && (
            <div className="center-wrap anim" style={{ '--delay': '0ms' }}>
              <div className="dark-card finalizing-card">
                <div className="fin-spinner" />
                <p className="fin-text">Compiling your proposal…</p>
              </div>
            </div>
          )}

          {/* ══ FINAL ══ */}
          {phase === 'final' && (
            <div className="final-layout anim" style={{ '--delay': '0ms' }}>

              {/* Meta row */}
              {(form?.title || fitData?.suggested_price || quality) && (
                <div className="meta-strip">
                  {form?.title && (
                    <div className="meta-item">
                      <span className="meta-label">Job</span>
                      <span className="meta-val">{form.title}</span>
                    </div>
                  )}
                  {fitData?.suggested_price && (
                    <div className="meta-item">
                      <span className="meta-label">Suggested Rate</span>
                      <span className="meta-val meta-val--price">{fitData.suggested_price}</span>
                    </div>
                  )}
                  {quality && (
                    <div className="meta-item">
                      <span className="meta-label">Quality Score</span>
                      <div className="meta-score-row">
                        <span className="meta-score-num" style={{ color: qualityColor(quality.score) }}>
                          {quality.score}
                        </span>
                        <span className="quality-badge" style={qualityBadgeStyle(quality.score)}>
                          {qualityLabel(quality.score)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Final proposal card */}
              <div className="light-card final-proposal-card">
                <div className="result-eyebrow">Your Proposal</div>
                <div className="final-scroll">
                  <pre className="proposal-text">{finalProposal}</pre>
                </div>
              </div>

              {/* Actions */}
              <div className="final-actions">
                <button className="btn-secondary" onClick={() => navigate('/new')}>
                  ← New Proposal
                </button>
                <div className="final-action-group">
                  <button className="btn-secondary" onClick={downloadTxt}>
                    ↓ Download .txt
                  </button>
                  <button className="btn-primary" onClick={copyToClipboard}>
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ ERROR ══ */}
          {phase === 'error' && (
            <div className="center-wrap anim" style={{ '--delay': '0ms' }}>
              <div className="dark-card error-card">
                <p className="error-icon">⚠</p>
                <p className="error-msg">{errorMsg || 'Something went wrong. Please try again.'}</p>
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

  /* ── Page ── */
  .page {
    position: relative;
    min-height: 100vh;
    height: 100vh;
    z-index: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Navbar ── */
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 40px;
    z-index: 10;
    flex-shrink: 0;
  }
  .nav-phase {}
  .nav-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    color: rgba(30,36,25,0.6);
  }
  .status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: dot-blink 1.4s ease-in-out infinite;
  }
  @keyframes dot-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
  .nav-label {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(30,36,25,0.5);
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    border-radius: 100px;
    padding: 5px 14px;
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
    white-space: nowrap;
    will-change: transform;
  }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.22); }
  .btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
  .btn-primary:disabled { opacity: 0.38; cursor: not-allowed; }

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
    transition: transform 200ms, box-shadow 200ms;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .btn-secondary:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.10); }
  .btn-secondary:active { transform: translateY(0); box-shadow: none; }

  /* ── Main ── */
  .gp-main {
    flex: 1;
    display: flex;
    overflow: hidden;
    padding: 0 24px 24px;
  }

  /* ── Two column layout ── */
  .two-col {
    display: flex;
    gap: 16px;
    flex: 1;
    overflow: hidden;
    width: 100%;
  }

  /* ── Glass cards ── */
  .dark-card {
    background: var(--glass-dark);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-dark-b);
    border-radius: 20px;
    padding: 28px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow: hidden;
  }

  .light-card {
    background: var(--glass-light);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-light-b);
    border-radius: 20px;
    padding: 28px 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
  }

  /* ── Pipeline column (dark, narrower) ── */
  .pipeline-col {
    flex: 0 0 280px;
  }

  /* ── Draft column (light) ── */
  .draft-col {
    flex: 1;
  }

  /* ── Proposal column (light) ── */
  .proposal-col {
    flex: 1;
    min-width: 0;
  }

  /* ── Critique column (dark) ── */
  .critique-col {
    flex: 0 0 300px;
    overflow-y: auto;
  }
  .critique-col::-webkit-scrollbar { width: 3px; }
  .critique-col::-webkit-scrollbar-track { background: transparent; }
  .critique-col::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  /* ── Shared card labels ── */
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

  .card-section-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  /* ── Node list (generating phase) ── */
  .node-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    transition: background 300ms;
  }
  .node-row--active { background: rgba(122,184,122,0.06); }
  .node-row--done   { background: rgba(255,255,255,0.02); }
  .node-row--idle   {}

  .node-circle {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    transition: background 300ms;
  }
  .node-circle--idle   { border: 1.5px solid rgba(255,255,255,0.1); background: transparent; }
  .node-circle--active {
    border: 1.5px solid var(--accent);
    background: rgba(122,184,122,0.1);
  }
  .node-circle--active::after {
    content: '';
    position: absolute; inset: -5px;
    border-radius: 50%;
    border: 1px solid var(--accent);
    opacity: 0.3;
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .node-circle--done { border: 1.5px solid var(--accent); background: rgba(122,184,122,0.18); }

  .nc-check { font-size: 13px; color: var(--accent); font-weight: 600; }
  .nc-idle  { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.15); }
  .nc-active {
    width: 8px; height: 8px; border-radius: 50%;
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

  .node-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .node-name {
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--text-light);
    transition: opacity 300ms;
  }
  .node-row--idle .node-name { opacity: 0.3; }
  .node-sub {
    font-family: var(--font);
    font-size: 11px;
    color: var(--text-light-muted);
    transition: opacity 300ms;
  }
  .node-row--idle .node-sub { opacity: 0.3; }

  .node-badge {
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 100px;
    padding: 3px 8px;
    white-space: nowrap;
  }
  .node-badge--idle   { color: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.08); }
  .node-badge--active { color: var(--accent); background: rgba(122,184,122,0.12); border: 1px solid rgba(122,184,122,0.25); }
  .node-badge--done   { color: rgba(122,184,122,0.7); background: rgba(122,184,122,0.08); border: 1px solid rgba(122,184,122,0.15); }

  .pipeline-status {
    font-family: var(--font);
    font-size: 11px;
    color: var(--text-light-muted);
    animation: blink-text 2s ease-in-out infinite;
  }
  @keyframes blink-text { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }

  /* ── Draft panel ── */
  .draft-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .char-count {
    font-family: var(--font);
    font-size: 11px;
    color: var(--text-muted);
  }

  .draft-scroll {
    flex: 1;
    overflow-y: auto;
    border-radius: 12px;
    border: 1px solid rgba(30,36,25,0.06);
    background: rgba(255,255,255,0.3);
    padding: 20px 22px;
  }
  .draft-scroll::-webkit-scrollbar { width: 3px; }
  .draft-scroll::-webkit-scrollbar-track { background: transparent; }
  .draft-scroll::-webkit-scrollbar-thumb { background: rgba(30,36,25,0.12); border-radius: 2px; }

  .draft-text {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.75;
    color: var(--text-dark);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .draft-cursor {
    display: inline-block;
    width: 2px; height: 1em;
    background: rgba(30,36,25,0.6);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: cursor-blink 0.9s ease-in-out infinite;
  }
  @keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  .draft-placeholder {
    font-family: var(--font);
    font-size: 13px;
    color: var(--text-muted);
    opacity: 0.5;
    animation: blink-text 2s ease-in-out infinite;
  }

  /* ── Proposal panel (review/revise) ── */
  .proposal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .result-eyebrow {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .result-title {
    font-family: var(--font);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: var(--text-dark);
    line-height: 1.1;
  }
  .approve-btn {
    margin-top: 4px;
    flex-shrink: 0;
  }

  .proposal-scroll {
    flex: 1;
    overflow-y: auto;
    border-radius: 12px;
    border: 1px solid rgba(30,36,25,0.06);
    background: rgba(255,255,255,0.3);
    padding: 20px 22px;
  }
  .proposal-scroll::-webkit-scrollbar { width: 3px; }
  .proposal-scroll::-webkit-scrollbar-track { background: transparent; }
  .proposal-scroll::-webkit-scrollbar-thumb { background: rgba(30,36,25,0.12); border-radius: 2px; }

  .proposal-text {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.75;
    color: var(--text-dark);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .proposal-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
  }

  /* ── Revision panel ── */
  .revision-panel {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: rgba(255,255,255,0.4);
    border-radius: 12px;
    border: 1px solid rgba(30,36,25,0.08);
    animation: fadeUp 300ms ease both;
  }
  .revise-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .revision-input {
    width: 100%;
    resize: vertical;
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(30,36,25,0.1);
    border-radius: 10px;
    padding: 11px 14px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.6;
    color: rgba(30,36,25,0.8);
    outline: none;
    transition: border-color 200ms;
  }
  .revision-input::placeholder { color: rgba(30,36,25,0.3); }
  .revision-input:focus { border-color: rgba(122,184,122,0.5); }

  .rev-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  /* ── Critique column content ── */
  .quality-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .quality-score-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .quality-num {
    font-family: var(--font);
    font-size: 52px;
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1;
    transition: color 400ms;
  }
  .quality-meta { display: flex; flex-direction: column; gap: 6px; }
  .quality-meta-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-light-muted);
  }
  .quality-badge {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 100px;
    padding: 4px 10px;
    width: fit-content;
  }

  .iter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .iter-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-light-muted);
  }
  .iter-val {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-light);
  }

  /* Mini pipeline in critique col */
  .pipeline-mini {
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .node-list-mini {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .node-mini {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .node-circle-sm {
    width: 24px; height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .node-circle-sm--idle   { border: 1px solid rgba(255,255,255,0.1); }
  .node-circle-sm--active { border: 1px solid var(--accent); background: rgba(122,184,122,0.1); }
  .node-circle-sm--done   { border: 1px solid var(--accent); background: rgba(122,184,122,0.15); }
  .nc-check-sm { font-size: 10px; color: var(--accent); font-weight: 600; }
  .nc-active-sm {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent);
    animation: pulse-dot 1.2s ease-in-out infinite;
  }
  .node-mini-name {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 400;
    color: var(--text-light);
    transition: opacity 300ms;
  }
  .node-mini--idle .node-mini-name { opacity: 0.3; }

  /* Critique toggle */
  .critique-section {}
  .critique-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-bottom: 10px;
  }
  .chevron {
    font-size: 14px;
    color: var(--text-light-muted);
    transition: transform 250ms ease;
    display: inline-block;
  }
  .chevron--open { transform: rotate(180deg); }
  .critique-body {
    font-family: var(--font);
    font-size: 13px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.65;
    color: var(--text-light-muted);
    animation: fadeUp 300ms ease both;
  }

  /* ── Finalizing ── */
  .center-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .finalizing-card {
    align-items: center;
    text-align: center;
    padding: 48px 60px;
  }
  .fin-spinner {
    width: 40px; height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(122,184,122,0.15);
    border-top-color: var(--accent);
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fin-text {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--text-light-muted);
    animation: blink-text 2s ease-in-out infinite;
  }

  /* ── Final layout ── */
  .final-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
  }
  .final-layout::-webkit-scrollbar { width: 3px; }
  .final-layout::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

  /* Meta strip */
  .meta-strip {
    background: var(--glass-dark);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-dark-b);
    border-radius: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    flex-shrink: 0;
  }
  .meta-item {
    flex: 1;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 20px;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .meta-item:last-child { border-right: none; }
  .meta-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-light-muted);
  }
  .meta-val {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--text-light);
  }
  .meta-val--price {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--accent);
  }
  .meta-score-row { display: flex; align-items: center; gap: 8px; }
  .meta-score-num {
    font-family: var(--font);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.035em;
  }

  /* Final proposal card */
  .final-proposal-card {
    flex: 1;
    overflow: hidden;
  }
  .final-scroll {
    flex: 1;
    overflow-y: auto;
    border-radius: 12px;
    border: 1px solid rgba(30,36,25,0.06);
    background: rgba(255,255,255,0.3);
    padding: 20px 22px;
    max-height: 52vh;
  }
  .final-scroll::-webkit-scrollbar { width: 3px; }
  .final-scroll::-webkit-scrollbar-thumb { background: rgba(30,36,25,0.12); border-radius: 2px; }

  .final-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    flex-shrink: 0;
    padding-bottom: 8px;
    padding-left: 4px;
  }
  .final-action-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .final-action-group .btn-secondary,
  .final-action-group .btn-primary { min-width: 152px; text-align: center; }

  /* ── Error ── */
  .error-card {
    align-items: center;
    text-align: center;
    padding: 48px 60px;
  }
  .error-icon { font-size: 28px; color: rgba(220,80,80,0.8); }
  .error-msg {
    font-family: var(--font);
    font-size: 14px;
    color: var(--text-light-muted);
    max-width: 360px;
    line-height: 1.6;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .nav { padding: 16px 20px; }
    .gp-main { padding: 0 12px 16px; }

    .two-col { flex-direction: column; overflow-y: auto; gap: 12px; }

    .pipeline-col { flex: unset; }
    .critique-col { flex: unset; }

    .dark-card, .light-card { padding: 20px 18px; gap: 14px; }

    .proposal-header { flex-direction: column; }
    .approve-btn { align-self: stretch; text-align: center; }

    .final-layout { max-width: 100%; }
    .meta-strip { flex-direction: column; }
    .meta-item { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .meta-item:last-child { border-bottom: none; }

    .final-actions { flex-direction: column-reverse; align-items: stretch; }
    .final-action-group { flex-direction: column-reverse; align-items: stretch; }
    .btn-secondary, .btn-primary { text-align: center; }

    .rev-actions { flex-direction: column-reverse; align-items: stretch; }
  }
`
