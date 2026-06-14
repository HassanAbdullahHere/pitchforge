import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../api'

const NODES = [
  { key: 'generator',        label: 'Drafting',   sub: 'proposal' },
  { key: 'critic',           label: 'Critiquing', sub: 'draft quality' },
  { key: 'human_checkpoint', label: 'Reviewing',  sub: 'awaiting input' },
  { key: 'compiler',         label: 'Compiling',  sub: 'final proposal' },
]

const INIT_NODES = Object.fromEntries(NODES.map(n => [n.key, 'idle']))
const MAX_REVISIONS = 2

async function readSSE(url, payload, onEvent, signal, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) {
    let detail = `Server error (${res.status})`
    try { const body = await res.json(); if (body.detail) detail = body.detail } catch {}
    throw new Error(detail)
  }
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
  const { authHeaders } = useAuth()

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

  const [revisionError, setRevisionError] = useState(null)
  const [revisionCount, setRevisionCount] = useState(0)

  const ctrlRef          = useRef(null)
  const draftRef         = useRef(null)
  const savedProposalRef = useRef('')
  const savedQualityRef  = useRef(null)
  const isRevisionRef    = useRef(false)

  useEffect(() => {
    if (draftRef.current) {
      draftRef.current.scrollTop = draftRef.current.scrollHeight
    }
  }, [proposalText])

  const handleEvents = (ev, data) => {
    if (ev === 'status') {
      setStatusText(data.message)
    } else if (ev === 'node_start') {
      setNodeStates(p => ({ ...p, [data.node]: 'active' }))
      setStatusText(data.label + '…')
      if (data.node === 'generator') setProposalText('')
    } else if (ev === 'node_complete') {
      setNodeStates(p => ({ ...p, [data.node]: 'done' }))
    } else if (ev === 'interrupt') {
      if (data.type === 'human_checkpoint') {
        setNodeStates(p => ({ ...p, human_checkpoint: 'done' }))
      }
    } else if (ev === 'token') {
      setProposalText(p => p + data.token)
    } else if (ev === 'done' && data.proposal_draft !== undefined) {
      setPhase('reviewing')
    } else if (ev === 'error') {
      if (isRevisionRef.current) {
        setProposalText(savedProposalRef.current)
        setQuality(savedQualityRef.current)
        setRevisionError(data.message)
        setPhase('reviewing')
        isRevisionRef.current = false
      } else {
        setErrorMsg(data.message)
        setPhase('error')
      }
    }
  }

  const startStream = async (url, payload) => {
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    try {
      const doneData = await readSSE(url, payload, handleEvents, ctrl.signal, authHeaders())
      if (doneData?.proposal_draft !== undefined) {
        setQuality({
          score: doneData.quality_score,
          feedback: doneData.critic_feedback,
          iterationCount: doneData.iteration_count,
        })
        if (isRevisionRef.current) {
          setRevisionCount(c => c + 1)
          isRevisionRef.current = false
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      if (isRevisionRef.current) {
        setProposalText(savedProposalRef.current)
        setQuality(savedQualityRef.current)
        setRevisionError(err.message || 'Revision failed. Please try again.')
        setPhase('reviewing')
        isRevisionRef.current = false
      } else {
        setErrorMsg(err.message || 'Something went wrong')
        setPhase('error')
      }
    }
  }

  useEffect(() => {
    if (!threadId) { navigate('/new', { replace: true }); return }
    startStream(`${API_BASE}/api/proposal/generate`, { thread_id: threadId, should_apply: true })
    return () => ctrlRef.current?.abort()
  }, [])

  const submitRevision = () => {
    if (!revisionInput.trim()) return
    savedProposalRef.current = proposalText
    savedQualityRef.current  = quality
    isRevisionRef.current    = true
    const instruction = revisionInput
    setRevisionInput('')
    setRevisionError(null)
    setPhase('generating')
    setNodeStates(INIT_NODES)
    setProposalText('')
    setStatusText('Applying revision…')
    setFeedbackOpen(false)
    startStream(`${API_BASE}/api/proposal/revise`, { thread_id: threadId, instruction })
  }

  const doFinalize = async () => {
    setPhase('finalizing')
    try {
      const res = await fetch(`${API_BASE}/api/proposal/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ thread_id: threadId }),
      })
      if (!res.ok) {
        let detail = `Server error (${res.status})`
        try { const body = await res.json(); if (body.detail) detail = body.detail } catch {}
        throw new Error(detail)
      }
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
            setRevisionError(data.message)
            setPhase('reviewing')
          }
        }
      }
    } catch (err) {
      setRevisionError(err.message || 'Failed to finalize. Please try again.')
      setPhase('reviewing')
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

  const qualityColor = s => s >= 70 ? '#5f8f68' : s >= 40 ? '#b88745' : '#b9574f'
  const qualityBadgeStyle = s => s >= 70
    ? { background: 'rgba(95,143,104,0.14)', color: '#78a980', border: '1px solid rgba(95,143,104,0.30)' }
    : s >= 40
    ? { background: 'rgba(184,135,69,0.14)', color: '#c79a58', border: '1px solid rgba(184,135,69,0.28)' }
    : { background: 'rgba(185,87,79,0.12)', color: '#c66a62', border: '1px solid rgba(185,87,79,0.28)' }
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
          <AnimatePresence mode="wait">

          {/* ══ GENERATING ══ */}
          {phase === 'generating' && (
            <motion.div className="two-col" key="generating"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >

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
            </motion.div>
          )}

          {/* ══ REVIEWING / REVISING ══ */}
          {(phase === 'reviewing' || phase === 'revising') && (
            <motion.div className="phase-fill" key="reviewing"
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.04 }}
            >
            <>
              {revisionError && (
                <div className="revision-error-banner" role="alert">
                  <span><svg width="14" height="14" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{verticalAlign:'middle',marginRight:6}}><path d="M16 3L29 27H3L16 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M16 13v6M16 23v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>{revisionError}</span>
                  <button className="revision-error-dismiss" onClick={() => setRevisionError(null)}>✕</button>
                </div>
              )}

            <div className="two-col">

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
                    {revisionCount >= MAX_REVISIONS && (
                      <span className="revision-limit-note">Revision limit reached</span>
                    )}
                    <button
                      className="btn-secondary revise-btn"
                      onClick={() => setPhase('revising')}
                      disabled={revisionCount >= MAX_REVISIONS}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{verticalAlign:'middle',marginRight:5}}><path d="M16.862 4.487l2.651 2.651L7 19.651H4.349V17L16.862 4.487Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> Request Revision {revisionCount > 0 && `(${revisionCount}/${MAX_REVISIONS})`}
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
            </>
            </motion.div>
          )}

          {/* ══ FINALIZING ══ */}
          {phase === 'finalizing' && (
            <motion.div className="center-wrap" key="finalizing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="dark-card finalizing-card">
                <div className="fin-spinner" />
                <p className="fin-text">Compiling your proposal…</p>
              </div>
            </motion.div>
          )}

          {/* ══ FINAL ══ */}
          {phase === 'final' && (
            <motion.div className="final-layout" key="final"
              initial={{ opacity: 0, scale: 0.97, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
            >

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
            </motion.div>
          )}

          {/* ══ ERROR ══ */}
          {phase === 'error' && (
            <motion.div className="center-wrap" key="error"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26 }}
            >
              <div className="dark-card error-card" role="alert">
                <svg className="error-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 3L29 27H3L16 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M16 13v6M16 23v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                <p className="error-msg">{errorMsg || 'Something went wrong. Please try again.'}</p>
                <button className="btn-secondary" onClick={() => navigate('/new')}>← Try Again</button>
              </div>
            </motion.div>
          )}

          </AnimatePresence>
        </main>
      </div>
    </>
  )
}

const css = `
  :root {
    --text-dark:       rgba(43,40,34,0.85);
    --text-muted:      rgba(43,40,34,0.45);
    --text-light:      rgba(248,246,238,0.92);
    --text-light-muted:rgba(248,246,238,0.58);
    --glass-light:     rgba(226,225,222,0.76);
    --glass-light-b:   rgba(212,210,208,0.90);
    --glass-dark:      rgba(14,14,26,0.86);
    --glass-dark-b:    rgba(255,255,255,0.09);
    --accent:          #7B6BE3;
    --accent-bg:       rgba(123,107,227,0.12);
    --accent-warm:     #c9a84c;
    --accent-warm-bg:  rgba(201,168,76,0.12);
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
    min-height: 100dvh;
    height: 100vh;
    height: 100dvh;
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
    color: rgba(43,40,34,0.6);
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
    color: rgba(43,40,34,0.5);
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    border-radius: 100px;
    padding: 5px 14px;
  }

  /* ── Buttons ── */
  .btn-primary {
    border-radius: 100px;
    background: var(--accent-warm);
    color: #1a1500;
    border: none;
    padding: 12px 24px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 200ms, background 200ms, box-shadow 200ms;
    letter-spacing: -0.01em;
    white-space: nowrap;
    will-change: transform;
  }
  .btn-primary:hover:not(:disabled) { background: #d4b55c; box-shadow: 0 4px 20px rgba(201,168,76,0.28); transform: translateY(-2px); }
  .btn-primary:active:not(:disabled) { background: var(--accent-warm); transform: translateY(0); box-shadow: none; }
  .btn-primary:disabled { opacity: 0.38; cursor: not-allowed; }

  .btn-secondary {
    border-radius: 100px;
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    color: rgba(43,40,34,0.8);
    padding: 12px 24px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 200ms, box-shadow 200ms;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .btn-secondary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.10); }
  .btn-secondary:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
  .btn-secondary:disabled { opacity: 0.38; cursor: not-allowed; }

  /* ── Main ── */
  .gp-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0 24px 24px;
    gap: 10px;
  }

  .phase-fill {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
  }

  /* ── Two column layout ── */
  .two-col {
    display: flex;
    gap: 16px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    width: 100%;
  }

  /* ── Glass cards ── */
  .dark-card {
    background: var(--glass-dark);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-dark-b);
    box-shadow: 0 22px 70px rgba(0,0,0,0.30);
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
  .node-row--active { background: rgba(123,107,227,0.08); }
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
    background: rgba(123,107,227,0.10);
  }
  .node-circle--active::after {
    content: '';
    position: absolute; inset: -5px;
    border-radius: 50%;
    border: 1px solid var(--accent);
    opacity: 0.3;
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .node-circle--done { border: 1.5px solid var(--accent); background: rgba(123,107,227,0.18); }

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
  .node-badge--active { color: rgba(230,226,250,0.88); background: rgba(123,107,227,0.14); border: 1px solid rgba(123,107,227,0.28); }
  .node-badge--done   { color: rgba(230,226,250,0.66); background: rgba(123,107,227,0.08); border: 1px solid rgba(123,107,227,0.16); }

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
    border: 1px solid rgba(43,40,34,0.06);
    background: rgba(255,255,255,0.3);
    padding: 20px 22px;
  }
  .draft-scroll::-webkit-scrollbar { width: 3px; }
  .draft-scroll::-webkit-scrollbar-track { background: transparent; }
  .draft-scroll::-webkit-scrollbar-thumb { background: rgba(43,40,34,0.12); border-radius: 2px; }

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
    background: rgba(43,40,34,0.6);
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
    min-height: 0;
    overflow-y: auto;
    border-radius: 12px;
    border: 1px solid rgba(43,40,34,0.08);
    background: rgba(255,255,255,0.62);
    padding: 20px 22px;
  }
  .proposal-scroll::-webkit-scrollbar { width: 3px; }
  .proposal-scroll::-webkit-scrollbar-track { background: transparent; }
  .proposal-scroll::-webkit-scrollbar-thumb { background: rgba(43,40,34,0.12); border-radius: 2px; }

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
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }
  .revision-limit-note {
    font-family: var(--font);
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.7;
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
    border: 1px solid rgba(43,40,34,0.08);
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
    border: 1px solid rgba(43,40,34,0.1);
    border-radius: 10px;
    padding: 11px 14px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.6;
    color: rgba(43,40,34,0.8);
    outline: none;
    transition: border-color 200ms;
  }
  .revision-input::placeholder { color: rgba(43,40,34,0.3); }
  .revision-input:focus { border-color: rgba(126,146,119,0.5); }

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
  .node-circle-sm--active { border: 1px solid var(--accent); background: rgba(126,146,119,0.1); }
  .node-circle-sm--done   { border: 1px solid var(--accent); background: rgba(126,146,119,0.15); }
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
    border: 2px solid rgba(126,146,119,0.15);
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
    border: 1px solid rgba(43,40,34,0.06);
    background: rgba(255,255,255,0.3);
    padding: 20px 22px;
    max-height: 52vh;
  }
  .final-scroll::-webkit-scrollbar { width: 3px; }
  .final-scroll::-webkit-scrollbar-thumb { background: rgba(43,40,34,0.12); border-radius: 2px; }

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

  /* ── Inline revision error banner ── */
  .revision-error-banner {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: rgba(220, 80, 80, 0.12);
    border: 1px solid rgba(220, 80, 80, 0.3);
    border-radius: 8px;
    font-family: var(--font);
    font-size: 13px;
    color: rgba(220, 100, 100, 0.95);
    animation: fadeUp 250ms ease both;
  }
  .revision-error-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255, 180, 180, 0.6);
    font-size: 14px;
    padding: 0 4px;
    flex-shrink: 0;
  }
  .revision-error-dismiss:hover { color: rgba(255, 180, 180, 1); }

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

  .nav-status {
    color: rgba(245,240,232,0.72);
  }
  .nav-label {
    color: rgba(245,240,232,0.66);
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.14);
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    /* Let the page grow and scroll instead of clipping to 100vh */
    .page { height: auto; overflow: auto; }
    .gp-main { overflow: visible; flex: unset; padding: 0 12px 32px; }

    .nav { padding: 16px 20px; }

    .two-col {
      flex-direction: column;
      overflow: visible;
      gap: 12px;
      height: auto;
    }

    .pipeline-col { flex: unset; }
    .critique-col { flex: unset; overflow: visible; }

    .dark-card, .light-card { padding: 20px 18px; gap: 14px; }

    /* Proposal scroll: fixed height so it's always readable, doesn't eat the whole screen */
    .proposal-scroll { max-height: 42vh; min-height: 160px; }

    .proposal-header { flex-direction: column; }
    .approve-btn { align-self: stretch; text-align: center; }

    .final-layout { max-width: 100%; overflow: visible; }
    .final-scroll { max-height: 40vh; }
    .meta-strip { flex-direction: column; }
    .meta-item { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .meta-item:last-child { border-bottom: none; }

    .final-actions { flex-direction: column-reverse; align-items: stretch; }
    .final-action-group { flex-direction: column-reverse; align-items: stretch; }
    .btn-secondary, .btn-primary { text-align: center; }

    .rev-actions { flex-direction: column-reverse; align-items: stretch; }

    .avatar-menu { right: -8px; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
`
