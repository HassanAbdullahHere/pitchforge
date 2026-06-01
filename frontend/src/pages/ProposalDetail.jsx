import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

const scoreColor = s =>
  s >= 70 ? 'rgba(80,170,80,0.9)' : s >= 50 ? 'rgba(200,155,60,0.9)' : 'rgba(210,80,80,0.9)'

const recStyle = r => {
  if (r === 'Strong Apply')    return { background: 'rgba(122,184,122,0.12)', color: 'rgba(80,170,80,0.9)',  border: '1px solid rgba(122,184,122,0.22)' }
  if (r === 'Apply Carefully') return { background: 'rgba(212,168,85,0.12)',  color: 'rgba(200,155,60,0.9)', border: '1px solid rgba(212,168,85,0.28)' }
  return                              { background: 'rgba(210,70,70,0.09)',   color: 'rgba(210,80,80,0.9)',  border: '1px solid rgba(210,70,70,0.2)' }
}

export default function ProposalDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { authHeaders } = useAuth()

  const [proposal, setProposal] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/proposals/${id}`, { headers: authHeaders() })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Proposal not found' : `Server returned ${r.status}`)
        return r.json()
      })
      .then(data => { if (!cancelled) { setProposal(data); setLoading(false) } })
      .catch(err  => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [id])

  const copy = () => {
    navigator.clipboard.writeText(proposal.final_proposal).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const download = () => {
    const slug = proposal.job_title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
    const blob = new Blob([proposal.final_proposal], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `proposal-${slug}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const done = proposal?.final_proposal != null
  const hasSkills = proposal && (
    (proposal.matched_skills?.length > 0) || (proposal.missing_skills?.length > 0)
  )
  const hasScores = proposal && (
    proposal.fit_score != null || proposal.quality_score != null ||
    proposal.recommendation || proposal.suggested_price || proposal.iteration_count != null
  )

  return (
    <>
      <style>{css}</style>
      <div className="pd-page">

        {/* Navbar */}
        <nav className="pd-nav">
          <Logo onClick={() => navigate('/')} />
          <button className="btn-primary" onClick={() => navigate('/new')}>
            + New Proposal
          </button>
        </nav>

        <main className="pd-main">
          <button className="pd-back" onClick={() => navigate('/proposals')}>
            ← Back to Proposals
          </button>

          {/* Loading skeleton */}
          {loading && (
            <div className="pd-skels">
              <div className="pd-skel pd-skel--h" />
              <div className="pd-skel pd-skel--scores" />
              <div className="pd-skel pd-skel--body" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="pd-empty">
              <p className="pd-empty-icon">⚠</p>
              <p className="pd-empty-title">{error}</p>
              <button className="btn-secondary" style={{ marginTop: '16px' }}
                onClick={() => navigate('/proposals')}>
                ← Back to Proposals
              </button>
            </div>
          )}

          {/* Detail */}
          {!loading && !error && proposal && (
            <div className="pd-content">

              {/* ── Job Header ── */}
              <div className="pd-header-card">
                <div className="pd-header-row">
                  {proposal.platform && (
                    <span className="pd-badge pd-badge--platform">{proposal.platform}</span>
                  )}
                  <span className={`pd-pill${done ? ' pd-pill--done' : ''}`}>
                    {done ? 'Completed' : 'In Progress'}
                  </span>
                  <span className="pd-time" title={formatDate(proposal.created_at)}>
                    {relativeTime(proposal.created_at)}
                  </span>
                </div>
                <h1 className="pd-job-title">{proposal.job_title}</h1>
                {(proposal.budget || proposal.timeline) && (
                  <div className="pd-job-meta">
                    {proposal.budget   && <span className="pd-meta-tag">{proposal.budget}</span>}
                    {proposal.timeline && <span className="pd-meta-tag">{proposal.timeline}</span>}
                  </div>
                )}
              </div>

              {/* ── Scores ── */}
              {hasScores && (
                <div className="pd-scores-card">
                  {proposal.fit_score != null && (
                    <div className="pd-score-item">
                      <span className="pd-score-num" style={{ color: scoreColor(proposal.fit_score) }}>
                        {proposal.fit_score}
                      </span>
                      <span className="pd-score-label">Fit Score</span>
                    </div>
                  )}
                  {proposal.quality_score != null && (
                    <div className="pd-score-item">
                      <span className="pd-score-num" style={{ color: scoreColor(proposal.quality_score) }}>
                        {proposal.quality_score}
                      </span>
                      <span className="pd-score-label">Quality</span>
                    </div>
                  )}
                  {proposal.iteration_count != null && (
                    <div className="pd-score-item">
                      <span className="pd-score-num" style={{ color: 'rgba(30,36,25,0.65)' }}>
                        {proposal.iteration_count}
                      </span>
                      <span className="pd-score-label">Iterations</span>
                    </div>
                  )}
                  {proposal.suggested_price && (
                    <div className="pd-score-item">
                      <span className="pd-score-text">{proposal.suggested_price}</span>
                      <span className="pd-score-label">Suggested Rate</span>
                    </div>
                  )}
                  {proposal.recommendation && (
                    <div className="pd-score-item">
                      <span className="pd-rec-badge" style={recStyle(proposal.recommendation)}>
                        {proposal.recommendation}
                      </span>
                      <span className="pd-score-label">Recommendation</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Skills ── */}
              {hasSkills && (
                <div className="pd-skills-card">
                  {proposal.matched_skills?.length > 0 && (
                    <div className="pd-skill-col">
                      <p className="pd-skill-heading pd-skill-heading--match">
                        You Bring
                        <span className="pd-skill-count">{proposal.matched_skills.length}</span>
                      </p>
                      <ul className="pd-skill-list">
                        {proposal.matched_skills.map((s, i) => (
                          <li key={i} className="pd-skill-chip pd-skill-chip--match">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {proposal.missing_skills?.length > 0 && (
                    <div className="pd-skill-col">
                      <p className="pd-skill-heading pd-skill-heading--miss">
                        Gaps to Bridge
                        <span className="pd-skill-count">{proposal.missing_skills.length}</span>
                      </p>
                      <ul className="pd-skill-list">
                        {proposal.missing_skills.map((s, i) => (
                          <li key={i} className="pd-skill-chip pd-skill-chip--miss">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ── Proposal text ── */}
              {done ? (
                <div className="pd-proposal-card">
                  <div className="pd-proposal-header">
                    <p className="pd-section-label">Final Proposal</p>
                    <div className="pd-proposal-actions">
                      <button className="btn-secondary pd-copy-btn" onClick={copy}>
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                      <button className="btn-secondary pd-copy-btn" onClick={download}>
                        ↓ Download
                      </button>
                    </div>
                  </div>
                  <div className="pd-proposal-body">
                    {proposal.final_proposal.split('\n\n').map((para, i) =>
                      para.trim() ? <p key={i} className="pd-para">{para}</p> : null
                    )}
                  </div>
                </div>
              ) : (
                <div className="pd-in-progress-card">
                  <p className="pd-in-progress-text">
                    This proposal is still in progress — no final text yet.
                  </p>
                </div>
              )}

            </div>
          )}

        </main>
      </div>
    </>
  )
}

const css = `
  :root {
    --text-dark:        rgba(30,36,25,0.88);
    --text-muted:       rgba(30,36,25,0.45);
    --glass-light:      rgba(226,225,222,0.78);
    --glass-light-b:    rgba(212,210,208,0.92);
    --font:             'Instrument Sans', sans-serif;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }

  .pd-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }

  /* ── Navbar ── */
  .pd-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 40px;
    z-index: 10;
  }
  .pd-back {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-dark);
    background: rgba(255,255,255,0.5);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(30,36,25,0.1);
    border-radius: 100px;
    cursor: pointer;
    padding: 9px 18px;
    letter-spacing: -0.01em;
    transition: background 150ms, transform 150ms;
    margin-bottom: 20px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .pd-back:hover  { background: rgba(255,255,255,0.72); transform: translateX(-2px); }
  .pd-back:active { transform: translateX(0); }

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
    transition: transform 200ms, box-shadow 200ms;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .btn-primary:hover  { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
  .btn-primary:active { transform: translateY(0); box-shadow: none; }

  .btn-secondary {
    border-radius: 100px;
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    color: rgba(30,36,25,0.8);
    padding: 9px 18px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 200ms, box-shadow 200ms;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .btn-secondary:hover  { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.09); }
  .btn-secondary:active { transform: translateY(0); }

  /* ── Main ── */
  .pd-main {
    flex: 1;
    padding: 8px 40px 56px;
    max-width: 820px;
    width: 100%;
    margin: 0 auto;
  }

  /* ── Skeletons ── */
  .pd-skels { display: flex; flex-direction: column; gap: 16px; }
  .pd-skel {
    border-radius: 16px;
    background: linear-gradient(
      90deg,
      rgba(200,198,196,0.45) 0%,
      rgba(222,220,218,0.72) 50%,
      rgba(200,198,196,0.45) 100%
    );
    background-size: 1200px 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
  .pd-skel--h      { height: 110px; }
  .pd-skel--scores { height: 88px;  }
  .pd-skel--body   { height: 340px; }

  /* ── Empty / Error ── */
  .pd-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80px 24px;
    gap: 8px;
    text-align: center;
  }
  .pd-empty-icon  { font-size: 26px; color: var(--text-muted); margin: 0 0 8px; }
  .pd-empty-title {
    font-family: var(--font);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-dark);
    margin: 0;
  }

  /* ── Content ── */
  .pd-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: fadeUp 320ms ease both;
  }

  /* Shared card shell */
  .pd-header-card,
  .pd-scores-card,
  .pd-skills-card,
  .pd-proposal-card,
  .pd-in-progress-card {
    background: var(--glass-light);
    backdrop-filter: blur(22px);
    border: 1px solid var(--glass-light-b);
    border-radius: 18px;
    padding: 24px 28px;
  }

  /* ── Header card ── */
  .pd-header-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .pd-badge {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    border-radius: 100px;
    padding: 3px 11px;
    letter-spacing: 0.02em;
  }
  .pd-badge--platform {
    background: rgba(30,36,25,0.06);
    color: rgba(30,36,25,0.55);
    border: 1px solid rgba(30,36,25,0.10);
  }
  .pd-pill {
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 100px;
    padding: 3px 10px;
    background: rgba(30,36,25,0.06);
    color: rgba(30,36,25,0.45);
    border: 1px solid rgba(30,36,25,0.08);
  }
  .pd-pill--done {
    background: rgba(100,170,100,0.1);
    color: rgba(80,170,80,0.9);
    border: 1px solid rgba(100,170,100,0.22);
  }
  .pd-time {
    font-family: var(--font);
    font-size: 12px;
    color: var(--text-muted);
    margin-left: auto;
  }
  .pd-job-title {
    font-family: var(--font);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: var(--text-dark);
    margin: 0 0 10px;
    line-height: 1.25;
  }
  .pd-job-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pd-meta-tag {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 100px;
    background: rgba(30,36,25,0.04);
    color: rgba(30,36,25,0.5);
    border: 1px solid rgba(30,36,25,0.08);
  }

  /* ── Scores card ── */
  .pd-scores-card {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    padding: 0;
    overflow: hidden;
  }
  .pd-score-item {
    flex: 1;
    min-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 20px 16px;
    border-right: 1px solid rgba(30,36,25,0.07);
  }
  .pd-score-item:last-child { border-right: none; }
  .pd-score-num {
    font-family: var(--font);
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .pd-score-text {
    font-family: var(--font);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-dark);
    line-height: 1;
  }
  .pd-score-label {
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .pd-rec-badge {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.01em;
    border-radius: 100px;
    padding: 4px 12px;
    text-align: center;
  }

  /* ── Skills card ── */
  .pd-skills-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    padding: 0;
    overflow: hidden;
  }
  .pd-skill-col {
    padding: 20px 24px;
  }
  .pd-skill-col:first-child:not(:last-child) {
    border-right: 1px solid rgba(30,36,25,0.07);
  }
  .pd-skill-heading {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin: 0 0 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pd-skill-heading--match { color: rgba(80,170,80,0.85); }
  .pd-skill-heading--miss  { color: rgba(210,80,80,0.8); }
  .pd-skill-count {
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    border-radius: 100px;
    padding: 1px 7px;
    background: rgba(30,36,25,0.06);
    color: var(--text-muted);
    letter-spacing: 0;
    text-transform: none;
  }
  .pd-skill-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pd-skill-chip {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    border-radius: 8px;
    padding: 5px 11px;
  }
  .pd-skill-chip--match {
    background: rgba(100,180,100,0.1);
    color: rgba(60,150,60,0.9);
    border: 1px solid rgba(100,180,100,0.18);
  }
  .pd-skill-chip--miss {
    background: rgba(210,80,80,0.08);
    color: rgba(180,60,60,0.85);
    border: 1px solid rgba(210,80,80,0.15);
  }

  /* ── Proposal card ── */
  .pd-proposal-card { padding: 0; overflow: hidden; }
  .pd-proposal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid rgba(30,36,25,0.07);
    flex-shrink: 0;
  }
  .pd-section-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0;
  }
  .pd-proposal-actions { display: flex; gap: 8px; }
  .pd-copy-btn { font-size: 12px; padding: 7px 16px; }
  .pd-proposal-body {
    padding: 24px 28px 28px;
  }
  .pd-para {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 400;
    line-height: 1.8;
    letter-spacing: -0.01em;
    color: var(--text-dark);
    margin: 0 0 16px;
    white-space: pre-line;
  }
  .pd-para:last-child { margin-bottom: 0; }

  /* ── In-progress card ── */
  .pd-in-progress-card {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }
  .pd-in-progress-text {
    font-family: var(--font);
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .pd-nav  { padding: 16px 20px; }
    .pd-main { padding: 8px 16px 40px; }
    .pd-job-title { font-size: 20px; }
    .pd-score-item { min-width: 90px; padding: 16px 12px; }
    .pd-score-num  { font-size: 26px; }
    .pd-skills-card { grid-template-columns: 1fr; }
    .pd-skill-col:first-child:not(:last-child) { border-right: none; border-bottom: 1px solid rgba(30,36,25,0.07); }
    .pd-proposal-header { padding: 14px 18px; }
    .pd-proposal-body   { padding: 18px 18px 22px; }
  }
`
