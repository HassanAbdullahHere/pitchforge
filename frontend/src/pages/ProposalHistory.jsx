import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../api'

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

const scoreColor  = s => s >= 70 ? '#5f8f68' : s >= 50 ? '#b88745' : '#b9574f'
const scoreBg     = s => s >= 70
  ? { background: 'rgba(95,143,104,0.14)', color: '#5f8f68',              border: '1px solid rgba(95,143,104,0.30)' }
  : s >= 50
  ? { background: 'rgba(184,135,69,0.14)',  color: '#b88745',              border: '1px solid rgba(184,135,69,0.28)' }
  : { background: 'rgba(185,87,79,0.12)',   color: '#b9574f',              border: '1px solid rgba(185,87,79,0.28)' }

const recColor = r => {
  if (r === 'Strong Apply')     return { background: 'rgba(201,168,76,0.12)', color: '#a07c20', border: '1px solid rgba(201,168,76,0.28)' }
  if (r === 'Apply Carefully')  return { background: 'rgba(212,168,85,0.1)',   color: 'rgba(170,120,20,0.9)',  border: '1px solid rgba(212,168,85,0.2)' }
  return                               { background: 'rgba(220,80,80,0.08)',   color: 'rgba(180,50,50,0.85)',  border: '1px solid rgba(220,80,80,0.15)' }
}

export default function ProposalHistory() {
  const navigate = useNavigate()
  const { authHeaders } = useAuth()

  const [proposals, setProposals]           = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting]             = useState(false)
  const [toast, setToast]                   = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/api/proposals/${confirmDeleteId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(res.status === 403 ? 'Access denied' : 'Delete failed')
      setProposals(prev => prev.filter(p => p.id !== confirmDeleteId))
      setConfirmDeleteId(null)
    } catch (e) {
      setConfirmDeleteId(null)
      showToast(e.message || 'Failed to delete proposal')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE}/api/proposals`, { headers: authHeaders(), signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`)
        return r.json()
      })
      .then(data => { setProposals(data); setLoading(false) })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false) } })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!confirmDeleteId) return
    const handler = (e) => { if (e.key === 'Escape' && !deleting) setConfirmDeleteId(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [confirmDeleteId, deleting])

  return (
    <>
      <style>{css}</style>
      <div className="ph-page">

        {/* ── Navbar ── */}
        <nav className="ph-nav">
          <Logo onClick={() => navigate('/')} />
          <button className="btn-primary" onClick={() => navigate('/new')}>
            + New Proposal
          </button>
        </nav>

        <main className="ph-main">
          <div className="ph-header">
            <h1 className="ph-title">Proposals</h1>
            <span className="ph-count">
              {!loading && !error && `${proposals.length} total`}
            </span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="ph-grid">
              {[0,1,2,3].map(i => (
                <div key={i} className="ph-skeleton" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="ph-empty">
              <p className="ph-empty-icon">⚠</p>
              <p className="ph-empty-text">Failed to load proposals</p>
              <p className="ph-empty-sub">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && proposals.length === 0 && (
            <div className="ph-empty">
              <p className="ph-empty-icon">✦</p>
              <p className="ph-empty-text">No proposals yet</p>
              <p className="ph-empty-sub">Analyze a job posting to get started</p>
              <button className="btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate('/new')}>
                Start Your First Proposal →
              </button>
            </div>
          )}

          {/* Confirm delete modal */}
          {confirmDeleteId && (
            <div className="ph-modal-overlay" onClick={() => !deleting && setConfirmDeleteId(null)}>
              <div className="ph-modal" onClick={e => e.stopPropagation()}>
                <p className="ph-modal-title">Delete this proposal?</p>
                <p className="ph-modal-sub">This action cannot be undone.</p>
                <div className="ph-modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div className="ph-toast" onClick={() => setToast(null)}>
              {toast}
            </div>
          )}

          {/* Proposal cards */}
          {!loading && !error && proposals.length > 0 && (
            <div className="ph-grid">
              {proposals.map(p => {
                const done = !!p.final_proposal
                return (
                  <div
                    key={p.id}
                    className={`ph-card${done ? ' ph-card--done' : ''}`}
                    onClick={() => navigate(`/proposals/${p.id}`)}
                    title="View details"
                  >
                    <div className="ph-card-top">
                      <span className={`ph-status-pill${done ? ' ph-status-pill--done' : ''}`}>
                        {done ? 'Completed' : 'In Progress'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ph-time">{relativeTime(p.created_at)}</span>
                        <button
                          className="ph-delete-btn"
                          title="Delete proposal"
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M1.75 3.5h10.5M5.25 3.5V2.333a.583.583 0 0 1 .583-.583h2.334a.583.583 0 0 1 .583.583V3.5M11.667 3.5l-.584 7.583a.583.583 0 0 1-.583.584H3.5a.583.583 0 0 1-.583-.584L2.333 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <h3 className="ph-job-title">{p.job_title}</h3>

                    <div className="ph-badges">
                      {p.platform && (
                        <span className="ph-badge ph-badge--platform">{p.platform}</span>
                      )}
                      {p.fit_score != null && (
                        <span className="ph-badge" style={scoreBg(p.fit_score)}>
                          Fit {p.fit_score}
                        </span>
                      )}
                      {p.recommendation && (
                        <span className="ph-badge" style={recColor(p.recommendation)}>
                          {p.recommendation}
                        </span>
                      )}
                    </div>

                    {done && p.quality_score != null && (
                      <div className="ph-quality-row">
                        <span className="ph-quality-label">Quality</span>
                        <span className="ph-quality-num" style={{ color: scoreColor(p.quality_score) }}>
                          {p.quality_score}
                        </span>
                      </div>
                    )}

                    <div className="ph-view-hint">View details →</div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

      </div>
    </>
  )
}

const css = `
  :root {
    --text-dark:        rgba(43,40,34,0.85);
    --text-muted:       rgba(43,40,34,0.45);
    --text-light:       rgba(255,255,255,0.88);
    --text-light-muted: rgba(255,255,255,0.4);
    --glass-light:      rgba(226,225,222,0.76);
    --glass-light-b:    rgba(212,210,208,0.90);
    --glass-dark:       rgba(12,12,22,0.78);
    --glass-dark-b:     rgba(255,255,255,0.09);
    --accent:           #7B6BE3;
    --accent-warm:      #c9a84c;
    --accent-warm-bg:   rgba(201,168,76,0.12);
    --font:             'Instrument Sans', sans-serif;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }

  .ph-page {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    z-index: 1;
    position: relative;
  }

  /* ── Navbar ── */
  .ph-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 40px;
    z-index: 10;
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
  }
  .btn-primary:hover { background: #d4b55c; box-shadow: 0 4px 20px rgba(201,168,76,0.28); transform: translateY(-2px); }
  .btn-primary:active { background: var(--accent-warm); transform: translateY(0); box-shadow: none; }

  .btn-secondary {
    border-radius: 100px;
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75);
    color: rgba(43,40,34,0.8);
    padding: 10px 20px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 200ms, box-shadow 200ms;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .btn-secondary:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.10); }
  .btn-secondary:active { transform: translateY(0); }

  /* ── Main ── */
  .ph-main {
    flex: 1;
    padding: 8px 40px 48px;
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
  }

  .ph-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 28px;
  }
  .ph-title {
    font-family: var(--font);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--text-dark);
    margin: 0;
  }
  .ph-count {
    font-family: var(--font);
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
  }

  /* ── Skeleton ── */
  .ph-skeleton {
    height: 180px;
    border-radius: 16px;
    background: linear-gradient(
      90deg,
      rgba(200,198,196,0.45) 0%,
      rgba(220,218,216,0.7) 50%,
      rgba(200,198,196,0.45) 100%
    );
    background-size: 800px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  /* ── Empty / Error ── */
  .ph-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
    gap: 8px;
    text-align: center;
  }
  .ph-empty-icon {
    font-size: 28px;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .ph-empty-text {
    font-family: var(--font);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-dark);
    margin: 0;
  }
  .ph-empty-sub {
    font-family: var(--font);
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
  }

  /* ── Grid ── */
  .ph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  /* ── Card ── */
  .ph-card {
    background: var(--glass-light);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-light-b);
    border-radius: 16px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: fadeUp 350ms ease both;
    transition: transform 200ms, box-shadow 200ms;
  }
  .ph-card {
    cursor: pointer;
  }
  .ph-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(0,0,0,0.10);
  }
  .ph-card:active {
    transform: translateY(0);
    box-shadow: none;
  }

  .ph-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ph-status-pill {
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 100px;
    padding: 3px 10px;
    background: rgba(43,40,34,0.06);
    color: rgba(43,40,34,0.45);
    border: 1px solid rgba(43,40,34,0.08);
  }
  .ph-status-pill--done {
    background: rgba(123,107,227,0.10);
    color: rgba(110,98,210,0.95);
    border: 1px solid rgba(123,107,227,0.20);
  }

  .ph-time {
    font-family: var(--font);
    font-size: 12px;
    color: var(--text-muted);
  }

  .ph-job-title {
    font-family: var(--font);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-dark);
    margin: 0;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ph-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .ph-badge {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    border-radius: 100px;
    padding: 3px 10px;
    white-space: nowrap;
  }
  .ph-badge--platform {
    background: rgba(43,40,34,0.05);
    color: rgba(43,40,34,0.55);
    border: 1px solid rgba(43,40,34,0.1);
  }

  .ph-quality-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid rgba(43,40,34,0.06);
  }
  .ph-quality-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .ph-quality-num {
    font-family: var(--font);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .ph-view-hint {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
    letter-spacing: -0.01em;
    opacity: 0;
    transition: opacity 200ms;
  }
  .ph-card:hover .ph-view-hint { opacity: 1; }

  /* ── Delete button on card ── */
  .ph-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: rgba(43,40,34,0.3);
    cursor: pointer;
    opacity: 0;
    transition: opacity 180ms, background 180ms, color 180ms;
    padding: 0;
  }
  .ph-card:hover .ph-delete-btn { opacity: 1; }
  .ph-delete-btn:hover {
    background: rgba(220,60,60,0.1);
    color: rgba(200,50,50,0.85);
  }
  .ph-delete-btn:active { transform: scale(0.93); }
  /* Always show delete on touch devices (hover never fires) */
  @media (hover: none) {
    .ph-delete-btn { opacity: 1; }
    .ph-view-hint  { opacity: 1; }
  }

  /* ── Confirm modal ── */
  .ph-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10,9,8,0.55);
    backdrop-filter: blur(4px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeUp 160ms ease both;
  }
  .ph-modal {
    background: rgba(240,238,234,0.96);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(212,210,208,0.9);
    border-radius: 16px;
    padding: 28px 32px;
    max-width: 360px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ph-modal-title {
    font-family: var(--font);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-dark);
    margin: 0;
  }
  .ph-modal-sub {
    font-family: var(--font);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .ph-modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .btn-danger {
    border-radius: 100px;
    background: rgba(200,50,50,0.88);
    color: rgba(255,255,255,0.95);
    border: none;
    padding: 10px 22px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 180ms, box-shadow 180ms;
    white-space: nowrap;
  }
  .btn-danger:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(180,30,30,0.25); }
  .btn-danger:active { transform: translateY(0); box-shadow: none; }
  .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  /* ── Toast ── */
  .ph-toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(12,12,24,0.92);
    color: rgba(255,255,255,0.88);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    padding: 12px 20px;
    border-radius: 100px;
    z-index: 300;
    cursor: pointer;
    animation: fadeUp 220ms ease both;
    white-space: nowrap;
  }

  .ph-header .ph-title,
  .ph-empty .ph-empty-text {
    color: rgba(255,253,246,0.96);
  }
  .ph-header .ph-count,
  .ph-empty .ph-empty-sub,
  .ph-empty .ph-empty-icon {
    color: rgba(245,240,232,0.66);
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .ph-nav  { padding: 16px 20px; }
    .ph-main { padding: 8px 20px 40px; }
    .ph-grid { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
`
