import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const navigate = useNavigate()
  const { user, authHeaders } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/profile', { headers: authHeaders() })
      .then(r => {
        if (r.status === 404) { navigate('/profile/edit?onboarding=true', { replace: true }); return null }
        if (!r.ok) throw new Error('Failed to load profile')
        return r.json()
      })
      .then(data => { if (data) setProfile(data) })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <style>{css}</style>
      <div className="page">

        {/* ── Navbar ── */}
        <nav className="nav">
          <Logo onClick={() => navigate('/')} />
          <div className="nav-links">
            <button className="nav-link nav-link-btn" onClick={() => navigate('/proposals')}>My Proposals</button>
          </div>
          <div className="nav-actions">
            <button className="btn-secondary nav-cta" onClick={() => navigate('/new')}>New Proposal</button>
            <button className="btn-primary nav-cta" onClick={() => navigate('/profile/edit')}>Edit Profile</button>
          </div>
        </nav>

        {loading ? (
          <div className="skeleton-wrap">
            <div className="skeleton skeleton--title" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line" style={{ width: '60%' }} />
            <div className="skeleton skeleton--section" />
            <div className="skeleton skeleton--section" />
          </div>
        ) : profile ? (
          <div className="content anim" style={{ '--delay': '0ms' }}>

            {/* ── Header ── */}
            <div className="profile-header glass-card">
              <div className="profile-avatar">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="avatar-img" />
                  : <span className="avatar-initial">{user?.name?.[0]?.toUpperCase()}</span>
                }
              </div>
              <div className="profile-meta">
                <h1 className="profile-name">{user?.name}</h1>
                {profile.title && <p className="profile-title">{profile.title}</p>}
                {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              </div>
            </div>

            <div className="sections">

              {/* ── Skills ── */}
              {profile.skills?.length > 0 && (
                <div className="section glass-card">
                  <div className="section-label">Skills</div>
                  <div className="tag-cloud">
                    {profile.skills.map((s, i) => (
                      <span key={i} className="tag">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Projects ── */}
              {profile.projects?.length > 0 && (
                <div className="section glass-card">
                  <div className="section-label">Projects</div>
                  <div className="project-grid">
                    {profile.projects.map((p, i) => (
                      <div key={i} className="project-card">
                        <div className="project-name">{p.name}</div>
                        <p className="project-desc">{p.description}</p>
                        {p.outcome && <p className="project-outcome">{p.outcome}</p>}
                        {p.tech?.length > 0 && (
                          <div className="tag-cloud tag-cloud--sm">
                            {p.tech.map((t, j) => <span key={j} className="tag tag--sm">{t}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Experience ── */}
              {profile.experience?.length > 0 && (
                <div className="section glass-card">
                  <div className="section-label">Experience</div>
                  <ul className="exp-list">
                    {profile.experience.map((e, i) => (
                      <li key={i} className="exp-item">{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Niches ── */}
              {profile.niches?.length > 0 && (
                <div className="section glass-card">
                  <div className="section-label">Specializations</div>
                  <div className="tag-cloud">
                    {profile.niches.map((n, i) => (
                      <span key={i} className="tag tag--niche">{n}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Rates ── */}
              {profile.rates && (
                <div className="section glass-card rates-card">
                  <div className="section-label">Rates</div>
                  <div className="rates-row">
                    <div className="rate-item">
                      <span className="rate-val">${profile.rates.hourly_min}–${profile.rates.hourly_max}</span>
                      <span className="rate-label">per hour</span>
                    </div>
                    <div className="rate-divider" />
                    <div className="rate-item">
                      <span className="rate-val">${profile.rates.fixed_min}+</span>
                      <span className="rate-label">fixed min</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-text">Could not load profile.</p>
            <button className="btn-primary" onClick={() => navigate('/profile/edit')}>Set Up Profile</button>
          </div>
        )}
      </div>
    </>
  )
}

const css = `
  :root {
    --text-dark:        rgba(30,36,25,0.85);
    --text-muted:       rgba(30,36,25,0.45);
    --glass-light:      rgba(226,225,222,0.76);
    --glass-light-b:    rgba(212,210,208,0.90);
    --accent:           #7ab87a;
    --font:             'Instrument Sans', sans-serif;
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

  @keyframes shimmer {
    from { background-position: -400px 0; }
    to   { background-position:  400px 0; }
  }

  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Nav ── */
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 40px;
    position: relative;
    z-index: 10;
  }
  .nav-links { display: flex; align-items: center; gap: 20px; }
  .nav-link-btn {
    font-family: var(--font);
    font-size: 14px;
    color: rgba(30,36,25,0.65);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 200ms;
  }
  .nav-link-btn:hover { color: var(--text-dark); }
  .nav-actions { display: flex; gap: 10px; }
  .nav-cta { padding: 9px 20px; font-size: 13px; }

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

  /* ── Content ── */
  .content {
    flex: 1;
    max-width: 860px;
    margin: 0 auto;
    width: 100%;
    padding: 8px 40px 60px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Glass card ── */
  .glass-card {
    background: var(--glass-light);
    backdrop-filter: blur(24px);
    border: 1px solid var(--glass-light-b);
    border-radius: 20px;
    padding: 28px 32px;
  }

  /* ── Profile header ── */
  .profile-header {
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }
  .profile-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(122,184,122,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .avatar-img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-initial {
    font-family: var(--font);
    font-size: 24px;
    font-weight: 600;
    color: var(--accent);
  }
  .profile-meta { flex: 1; }
  .profile-name {
    font-family: var(--font);
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-dark);
    margin: 0 0 4px;
  }
  .profile-title {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    color: var(--accent);
    margin: 0 0 10px;
    letter-spacing: -0.01em;
  }
  .profile-bio {
    font-family: var(--font);
    font-size: 14px;
    color: rgba(30,36,25,0.65);
    margin: 0;
    line-height: 1.6;
  }

  /* ── Sections ── */
  .sections { display: flex; flex-direction: column; gap: 16px; }
  .section-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 14px;
  }

  /* ── Tags ── */
  .tag-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
  .tag {
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(30,36,25,0.1);
    border-radius: 100px;
    padding: 5px 12px;
    font-family: var(--font);
    font-size: 13px;
    color: rgba(30,36,25,0.75);
    font-weight: 400;
  }
  .tag--niche {
    background: rgba(122,184,122,0.12);
    border-color: rgba(122,184,122,0.3);
    color: rgba(60,110,60,0.85);
  }
  .tag-cloud--sm { margin-top: 10px; }
  .tag--sm { font-size: 11px; padding: 3px 9px; }

  /* ── Projects ── */
  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .project-card {
    background: rgba(255,255,255,0.55);
    border: 1px solid rgba(30,36,25,0.08);
    border-radius: 14px;
    padding: 18px 20px;
  }
  .project-name {
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-dark);
    margin-bottom: 6px;
    letter-spacing: -0.02em;
  }
  .project-desc {
    font-family: var(--font);
    font-size: 13px;
    color: rgba(30,36,25,0.6);
    line-height: 1.5;
    margin: 0 0 6px;
  }
  .project-outcome {
    font-family: var(--font);
    font-size: 12px;
    color: rgba(60,110,60,0.8);
    font-style: italic;
    margin: 0;
    line-height: 1.4;
  }

  /* ── Experience ── */
  .exp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .exp-item {
    font-family: var(--font);
    font-size: 14px;
    color: rgba(30,36,25,0.7);
    line-height: 1.5;
    padding-left: 16px;
    position: relative;
  }
  .exp-item::before {
    content: '–';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-weight: 600;
  }

  /* ── Rates ── */
  .rates-row { display: flex; align-items: center; gap: 24px; }
  .rate-item { display: flex; flex-direction: column; gap: 2px; }
  .rate-val {
    font-family: var(--font);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-dark);
    letter-spacing: -0.04em;
  }
  .rate-label {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .rate-divider {
    width: 1px;
    height: 40px;
    background: rgba(30,36,25,0.1);
  }

  /* ── Skeleton ── */
  .skeleton-wrap {
    max-width: 860px;
    margin: 24px auto;
    width: 100%;
    padding: 0 40px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .skeleton {
    border-radius: 14px;
    background: linear-gradient(90deg, rgba(226,225,222,0.8) 25%, rgba(240,239,236,0.9) 50%, rgba(226,225,222,0.8) 75%);
    background-size: 800px 100%;
    animation: shimmer 1.6s infinite linear;
  }
  .skeleton--title { height: 120px; border-radius: 20px; }
  .skeleton--line  { height: 24px; }
  .skeleton--section { height: 100px; border-radius: 20px; }

  /* ── Empty state ── */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 40px;
  }
  .empty-text {
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-muted);
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .nav { padding: 16px 20px; }
    .nav-links { display: none; }
    .content { padding: 8px 16px 40px; }
    .glass-card { padding: 20px; }
    .profile-header { flex-direction: column; }
    .skeleton-wrap { padding: 0 16px; }
    .project-grid { grid-template-columns: 1fr; }
    .nav-actions { gap: 8px; }
    .nav-cta { padding: 8px 14px; font-size: 12px; }
  }
`
