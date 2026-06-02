import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

const EMPTY_PROJECT = { name: '', description: '', tech: [], outcome: '' }
const EMPTY_RATES   = { hourly_min: 0, hourly_max: 0, fixed_min: 0 }

const EMPTY_FORM = {
  title: '', bio: '', skills: [], projects: [], experience: [], niches: [], rates: { ...EMPTY_RATES },
}

export default function ProfileForm() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { authHeaders } = useAuth()

  const isOnboarding = new URLSearchParams(location.search).get('onboarding') === 'true'

  const [form, setForm]           = useState(EMPTY_FORM)
  const [loading, setLoading]     = useState(!isOnboarding)
  const [saving, setSaving]       = useState(false)
  const [parsing, setParsing]     = useState(false)
  const [error, setError]         = useState(null)
  const [parseError, setParseError] = useState(null)
  const [skillInput, setSkillInput] = useState('')
  const [nicheInput, setNicheInput] = useState('')
  const [techInputs, setTechInputs] = useState({}) // project index → string

  const fileRef = useRef(null)

  // Load existing profile when editing
  useEffect(() => {
    if (isOnboarding) return
    fetch('/api/profile', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setForm({
          title:      data.title ?? '',
          bio:        data.bio ?? '',
          skills:     data.skills ?? [],
          projects:   (data.projects ?? []).map(p => ({
            name: p.name ?? '', description: p.description ?? '',
            tech: p.tech ?? [], outcome: p.outcome ?? '',
          })),
          experience: data.experience ?? [],
          niches:     data.niches ?? [],
          rates:      data.rates ?? { ...EMPTY_RATES },
        })
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Tag helpers ──
  function addTag(field, value, setter) {
    const v = value.trim().replace(/,$/, '').trim()
    if (!v) return
    setForm(f => ({ ...f, [field]: [...f[field], v] }))
    setter('')
  }
  function removeTag(field, idx) {
    setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))
  }
  function onTagKey(e, field, value, setter) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(field, value, setter) }
  }

  // ── Project helpers ──
  function addProject() { setForm(f => ({ ...f, projects: [...f.projects, { ...EMPTY_PROJECT, tech: [] }] })) }
  function removeProject(i) { setForm(f => ({ ...f, projects: f.projects.filter((_, idx) => idx !== i) })) }
  function setProject(i, key, val) {
    setForm(f => { const p = [...f.projects]; p[i] = { ...p[i], [key]: val }; return { ...f, projects: p } })
  }
  function addProjectTech(i) {
    const v = (techInputs[i] ?? '').trim()
    if (!v) return
    setProject(i, 'tech', [...(form.projects[i].tech ?? []), v])
    setTechInputs(t => ({ ...t, [i]: '' }))
  }
  function removeProjectTech(pi, ti) {
    setProject(pi, 'tech', form.projects[pi].tech.filter((_, idx) => idx !== ti))
  }

  // ── Experience helpers ──
  function addExp() { setForm(f => ({ ...f, experience: [...f.experience, ''] })) }
  function removeExp(i) { setForm(f => ({ ...f, experience: f.experience.filter((_, idx) => idx !== i) })) }
  function setExp(i, val) {
    setForm(f => { const e = [...f.experience]; e[i] = val; return { ...f, experience: e } })
  }

  // ── Resume upload ──
  async function handleResumeUpload(file) {
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setParseError('Only PDF and DOCX files are supported.'); return
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File too large. Maximum size is 5 MB.'); return
    }
    setParseError(null)
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/profile/parse-resume', { method: 'POST', headers: authHeaders(), body: fd })
      const data = await r.json()
      if (!r.ok) { setParseError(data.detail ?? 'Parsing failed.'); return }
      const p = data.parsed
      if (p) {
        setForm({
          title:      p.title ?? '',
          bio:        p.bio ?? '',
          skills:     p.skills ?? [],
          projects:   (p.projects ?? []).map(x => ({
            name: x.name ?? '', description: x.description ?? '',
            tech: x.tech ?? [], outcome: x.outcome ?? '',
          })),
          experience: p.experience ?? [],
          niches:     p.niches ?? [],
          rates:      p.rates ?? { ...EMPTY_RATES },
        })
      }
    } catch { setParseError('Could not reach the server. Try again.') }
    finally { setParsing(false) }
  }

  // ── Save ──
  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        title:      form.title.trim(),
        bio:        form.bio.trim(),
        skills:     form.skills,
        projects:   form.projects.map(p => ({
          name: p.name.trim(), description: p.description.trim(),
          tech: p.tech, outcome: p.outcome?.trim() || null,
        })),
        experience: form.experience.filter(e => e.trim()),
        niches:     form.niches,
        rates:      form.rates,
      }
      const r = await fetch('/api/profile', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.detail ?? 'Failed to save profile.')
        return
      }
      navigate('/profile', { replace: true })
    } catch { setError('Could not reach the server. Try again.') }
    finally { setSaving(false) }
  }

  function handleCancel() { navigate(isOnboarding ? '/' : '/profile') }

  if (loading) return null

  return (
    <>
      <style>{css}</style>
      <div className="page">

        {/* ── Navbar ── */}
        <nav className="nav">
          <Logo onClick={() => navigate('/')} />
          <button className="btn-secondary nav-cta" onClick={handleCancel}>
            {isOnboarding ? '← Back' : '← Cancel'}
          </button>
        </nav>

        <div className="content">
          <div className="page-header anim" style={{ '--delay': '0ms' }}>
            <div className="badge-pill">{isOnboarding ? 'Onboarding' : 'Settings'}</div>
            <h1 className="page-title">{isOnboarding ? 'Complete Your Profile' : 'Edit Profile'}</h1>
            <p className="page-sub">
              {isOnboarding
                ? 'Your profile powers the AI — skills, projects, and rates are used to match and price every proposal.'
                : 'Update your profile. All new proposals will use the latest version.'}
            </p>
          </div>

          {/* ── Resume upload ── */}
          <div
            className={`resume-zone anim glass-card${parsing ? ' resume-zone--loading' : ''}`}
            style={{ '--delay': '60ms' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleResumeUpload(e.dataTransfer.files[0]) }}
            onClick={() => !parsing && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx"
              style={{ display: 'none' }}
              onChange={e => handleResumeUpload(e.target.files[0])}
            />
            {parsing ? (
              <div className="parse-loading">
                <div className="spinner" />
                <span className="parse-text">Parsing resume…</span>
              </div>
            ) : (
              <>
                <span className="resume-icon">↑</span>
                <span className="resume-label">Drop your resume here or click to upload</span>
                <span className="resume-hint">PDF or DOCX · max 5 MB · pre-fills the form below</span>
              </>
            )}
          </div>
          {parseError && <div className="error-bar">{parseError}</div>}

          <form onSubmit={handleSave} className="form-body anim" style={{ '--delay': '120ms' }}>

            {/* ── Identity ── */}
            <div className="glass-card section-card">
              <div className="section-label">Identity</div>
              <div className="field">
                <label className="field-label">Professional Title</label>
                <input className="field-input" type="text" placeholder="e.g. Backend & AI Developer"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field-label">Bio</label>
                <textarea className="field-textarea" rows={3}
                  placeholder="2-3 sentences about your background and what you build."
                  value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
              </div>
            </div>

            {/* ── Skills ── */}
            <div className="glass-card section-card">
              <div className="section-label">Skills</div>
              <div className="tag-cloud">
                {form.skills.map((s, i) => (
                  <span key={i} className="tag">
                    {s}
                    <button type="button" className="tag-remove" onClick={() => removeTag('skills', i)}>×</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-row">
                <input className="field-input" type="text" placeholder="Add skill (press Enter)"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => onTagKey(e, 'skills', skillInput, setSkillInput)}
                />
                <button type="button" className="btn-add" onClick={() => addTag('skills', skillInput, setSkillInput)}>Add</button>
              </div>
            </div>

            {/* ── Projects ── */}
            <div className="glass-card section-card">
              <div className="section-label-row">
                <div className="section-label">Projects</div>
                <button type="button" className="btn-add-section" onClick={addProject}>+ Add Project</button>
              </div>
              {form.projects.length === 0 && (
                <p className="empty-hint">No projects added yet. Click "Add Project" above.</p>
              )}
              {form.projects.map((p, i) => (
                <div key={i} className="item-card">
                  <div className="item-card-header">
                    <span className="item-index">Project {i + 1}</span>
                    <button type="button" className="btn-remove" onClick={() => removeProject(i)}>Remove</button>
                  </div>
                  <div className="field">
                    <label className="field-label">Name</label>
                    <input className="field-input" type="text" placeholder="Project name"
                      value={p.name} onChange={e => setProject(i, 'name', e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">Description</label>
                    <textarea className="field-textarea" rows={2}
                      placeholder="What it does and what problem it solved."
                      value={p.description} onChange={e => setProject(i, 'description', e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">Outcome (optional)</label>
                    <input className="field-input" type="text" placeholder="e.g. Reduced processing time by 40%"
                      value={p.outcome ?? ''} onChange={e => setProject(i, 'outcome', e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">Tech Stack</label>
                    <div className="tag-cloud">
                      {(p.tech ?? []).map((t, j) => (
                        <span key={j} className="tag tag--sm">
                          {t}
                          <button type="button" className="tag-remove" onClick={() => removeProjectTech(i, j)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="tag-input-row" style={{ marginTop: 8 }}>
                      <input className="field-input" type="text" placeholder="Add tech (press Enter)"
                        value={techInputs[i] ?? ''}
                        onChange={e => setTechInputs(t => ({ ...t, [i]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addProjectTech(i) } }}
                      />
                      <button type="button" className="btn-add" onClick={() => addProjectTech(i)}>Add</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Experience ── */}
            <div className="glass-card section-card">
              <div className="section-label-row">
                <div className="section-label">Experience</div>
                <button type="button" className="btn-add-section" onClick={addExp}>+ Add</button>
              </div>
              {form.experience.length === 0 && (
                <p className="empty-hint">Each line is a short achievement or role. Keep them punchy.</p>
              )}
              {form.experience.map((exp, i) => (
                <div key={i} className="exp-row">
                  <input className="field-input" type="text"
                    placeholder="e.g. Built and deployed AI pipelines on AWS EC2"
                    value={exp} onChange={e => setExp(i, e.target.value)} />
                  <button type="button" className="btn-remove-sm" onClick={() => removeExp(i)}>×</button>
                </div>
              ))}
            </div>

            {/* ── Niches ── */}
            <div className="glass-card section-card">
              <div className="section-label">Specializations</div>
              <div className="tag-cloud">
                {form.niches.map((n, i) => (
                  <span key={i} className="tag tag--niche">
                    {n}
                    <button type="button" className="tag-remove" onClick={() => removeTag('niches', i)}>×</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-row">
                <input className="field-input" type="text" placeholder="Add specialization (press Enter)"
                  value={nicheInput}
                  onChange={e => setNicheInput(e.target.value)}
                  onKeyDown={e => onTagKey(e, 'niches', nicheInput, setNicheInput)}
                />
                <button type="button" className="btn-add" onClick={() => addTag('niches', nicheInput, setNicheInput)}>Add</button>
              </div>
            </div>

            {/* ── Rates ── */}
            <div className="glass-card section-card">
              <div className="section-label">Rates</div>
              <div className="rates-row">
                <div className="field">
                  <label className="field-label">Hourly Min ($)</label>
                  <input className="field-input" type="number" min={0} placeholder="15"
                    value={form.rates.hourly_min || ''}
                    onChange={e => setForm(f => ({ ...f, rates: { ...f.rates, hourly_min: +e.target.value || 0 } }))} />
                </div>
                <div className="field">
                  <label className="field-label">Hourly Max ($)</label>
                  <input className="field-input" type="number" min={0} placeholder="40"
                    value={form.rates.hourly_max || ''}
                    onChange={e => setForm(f => ({ ...f, rates: { ...f.rates, hourly_max: +e.target.value || 0 } }))} />
                </div>
                <div className="field">
                  <label className="field-label">Fixed Min ($)</label>
                  <input className="field-input" type="number" min={0} placeholder="100"
                    value={form.rates.fixed_min || ''}
                    onChange={e => setForm(f => ({ ...f, rates: { ...f.rates, fixed_min: +e.target.value || 0 } }))} />
                </div>
              </div>
            </div>

            {error && <div className="error-bar">{error}</div>}

            {/* ── Actions ── */}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleCancel} disabled={saving}>
                {isOnboarding ? 'Back' : 'Cancel'}
              </button>
              <button type="submit" className="btn-primary btn-save" disabled={saving}>
                {saving ? 'Saving…' : isOnboarding ? 'Save & Continue →' : 'Save Changes'}
              </button>
            </div>

          </form>
        </div>
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

  @keyframes spin { to { transform: rotate(360deg); } }

  .page { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Nav ── */
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 40px; position: relative; z-index: 10;
  }
  .nav-cta { padding: 9px 20px; font-size: 13px; }

  /* ── Buttons ── */
  .btn-primary {
    border-radius: 100px; background: rgba(26,31,22,0.88); color: rgba(255,255,255,0.92);
    border: none; padding: 12px 24px; font-family: var(--font); font-size: 14px;
    font-weight: 500; cursor: pointer; transition: transform 200ms, opacity 200ms; letter-spacing: -0.01em;
  }
  .btn-primary:hover:not(:disabled) { transform: scale(1.02); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    border-radius: 100px; background: rgba(255,255,255,0.55); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75); color: rgba(30,36,25,0.8);
    padding: 12px 24px; font-family: var(--font); font-size: 14px; font-weight: 500;
    cursor: pointer; transition: transform 200ms; letter-spacing: -0.01em;
  }
  .btn-secondary:hover { transform: scale(1.02); }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Content ── */
  .content {
    flex: 1; max-width: 720px; margin: 0 auto; width: 100%;
    padding: 8px 40px 60px; display: flex; flex-direction: column; gap: 16px;
  }

  /* ── Page header ── */
  .page-header { display: flex; flex-direction: column; gap: 8px; }
  .badge-pill {
    display: inline-flex; align-items: center;
    background: rgba(255,255,255,0.55); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.75); border-radius: 100px;
    padding: 5px 12px; font-family: var(--font); font-size: 11px; font-weight: 500;
    letter-spacing: 0.04em; text-transform: uppercase; color: rgba(30,36,25,0.6); width: fit-content;
  }
  .page-title {
    font-family: var(--font); font-size: 2rem; font-weight: 700;
    letter-spacing: -0.035em; color: var(--text-dark); line-height: 1.1;
  }
  .page-sub {
    font-family: var(--font); font-size: 14px; color: var(--text-muted); line-height: 1.5;
  }

  /* ── Resume zone ── */
  .resume-zone {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6px; padding: 28px; cursor: pointer; transition: border-color 200ms;
    border: 2px dashed rgba(122,184,122,0.4); border-radius: 16px;
    background: rgba(122,184,122,0.05);
    min-height: 100px;
  }
  .resume-zone:hover { border-color: rgba(122,184,122,0.7); background: rgba(122,184,122,0.08); }
  .resume-zone--loading { cursor: default; pointer-events: none; }
  .resume-icon { font-size: 24px; color: var(--accent); }
  .resume-label { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--text-dark); }
  .resume-hint  { font-family: var(--font); font-size: 12px; color: var(--text-muted); }
  .parse-loading { display: flex; align-items: center; gap: 10px; }
  .spinner {
    width: 18px; height: 18px; border: 2px solid rgba(122,184,122,0.3);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .parse-text { font-family: var(--font); font-size: 14px; color: var(--text-muted); }

  /* ── Glass card ── */
  .glass-card {
    background: var(--glass-light); backdrop-filter: blur(24px);
    border: 1px solid var(--glass-light-b); border-radius: 20px;
  }

  /* ── Form ── */
  .form-body { display: flex; flex-direction: column; gap: 16px; }
  .section-card { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; }

  .section-label {
    font-family: var(--font); font-size: 11px; font-weight: 500; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--text-muted); margin-bottom: -4px;
  }
  .section-label-row { display: flex; align-items: center; justify-content: space-between; }

  /* ── Fields ── */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label {
    font-family: var(--font); font-size: 11px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted);
  }
  .field-input {
    background: rgba(255,255,255,0.7); border: 1px solid rgba(30,36,25,0.1);
    border-radius: 10px; padding: 11px 14px; font-family: var(--font); font-size: 14px;
    color: rgba(30,36,25,0.8); outline: none; transition: border-color 200ms; width: 100%;
  }
  .field-input::placeholder { color: rgba(30,36,25,0.3); }
  .field-input:focus { border-color: rgba(122,184,122,0.5); box-shadow: 0 0 0 3px rgba(122,184,122,0.1); }
  input[type=number].field-input { -moz-appearance: textfield; }
  input[type=number].field-input::-webkit-outer-spin-button,
  input[type=number].field-input::-webkit-inner-spin-button { -webkit-appearance: none; }

  .field-textarea {
    background: rgba(255,255,255,0.7); border: 1px solid rgba(30,36,25,0.1);
    border-radius: 10px; padding: 11px 14px; font-family: var(--font); font-size: 14px;
    color: rgba(30,36,25,0.8); outline: none; resize: vertical; transition: border-color 200ms; width: 100%;
    line-height: 1.6;
  }
  .field-textarea::placeholder { color: rgba(30,36,25,0.3); }
  .field-textarea:focus { border-color: rgba(122,184,122,0.5); box-shadow: 0 0 0 3px rgba(122,184,122,0.1); }

  /* ── Tags ── */
  .tag-cloud { display: flex; flex-wrap: wrap; gap: 8px; min-height: 8px; }
  .tag {
    background: rgba(255,255,255,0.7); border: 1px solid rgba(30,36,25,0.1);
    border-radius: 100px; padding: 5px 10px 5px 12px; font-family: var(--font);
    font-size: 13px; color: rgba(30,36,25,0.75); display: flex; align-items: center; gap: 6px;
  }
  .tag--niche {
    background: rgba(122,184,122,0.12); border-color: rgba(122,184,122,0.3); color: rgba(60,110,60,0.85);
  }
  .tag--sm { font-size: 11px; padding: 3px 7px 3px 9px; }
  .tag-remove {
    background: transparent; border: none; cursor: pointer; color: rgba(30,36,25,0.3);
    font-size: 14px; line-height: 1; padding: 0; transition: color 150ms;
  }
  .tag-remove:hover { color: rgba(200,60,60,0.7); }
  .tag-input-row { display: flex; gap: 8px; align-items: stretch; }
  .tag-input-row .field-input { flex: 1; }

  /* ── Btn-add / btn-add-section ── */
  .btn-add {
    border-radius: 10px; background: rgba(26,31,22,0.08); border: 1px solid rgba(30,36,25,0.1);
    color: rgba(30,36,25,0.7); padding: 0 16px; font-family: var(--font); font-size: 13px;
    font-weight: 500; cursor: pointer; transition: background 200ms; white-space: nowrap;
  }
  .btn-add:hover { background: rgba(26,31,22,0.14); }

  .btn-add-section {
    font-family: var(--font); font-size: 12px; font-weight: 500; color: var(--accent);
    background: rgba(122,184,122,0.1); border: 1px solid rgba(122,184,122,0.25);
    border-radius: 100px; padding: 5px 14px; cursor: pointer; transition: background 200ms;
  }
  .btn-add-section:hover { background: rgba(122,184,122,0.18); }

  /* ── Item card (project) ── */
  .item-card {
    background: rgba(255,255,255,0.5); border: 1px solid rgba(30,36,25,0.07);
    border-radius: 14px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;
  }
  .item-card-header { display: flex; align-items: center; justify-content: space-between; }
  .item-index {
    font-family: var(--font); font-size: 11px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted);
  }
  .btn-remove {
    font-family: var(--font); font-size: 12px; color: rgba(200,60,60,0.6);
    background: transparent; border: 1px solid rgba(200,60,60,0.2);
    border-radius: 100px; padding: 3px 10px; cursor: pointer; transition: all 200ms;
  }
  .btn-remove:hover { background: rgba(200,60,60,0.08); color: rgba(200,60,60,0.9); }

  /* ── Experience rows ── */
  .exp-row { display: flex; align-items: center; gap: 8px; }
  .exp-row .field-input { flex: 1; }
  .btn-remove-sm {
    background: transparent; border: none; color: rgba(30,36,25,0.3); font-size: 18px;
    cursor: pointer; transition: color 150ms; padding: 0 4px; flex-shrink: 0;
  }
  .btn-remove-sm:hover { color: rgba(200,60,60,0.7); }

  /* ── Rates ── */
  .rates-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

  /* ── Empty hint ── */
  .empty-hint {
    font-family: var(--font); font-size: 13px; color: var(--text-muted);
    font-style: italic; margin: 0;
  }

  /* ── Error bar ── */
  .error-bar {
    background: rgba(220,80,80,0.1); border: 1px solid rgba(220,80,80,0.25);
    border-radius: 10px; padding: 12px 16px; font-family: var(--font); font-size: 13px;
    color: rgba(200,50,50,0.9);
  }

  /* ── Form actions ── */
  .form-actions {
    display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px;
  }
  .btn-save { min-width: 160px; }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .nav { padding: 16px 20px; }
    .content { padding: 8px 16px 40px; }
    .section-card { padding: 18px 20px; }
    .rates-row { grid-template-columns: 1fr; }
    .form-actions { flex-direction: column; }
    .btn-save { width: 100%; }
    .btn-secondary { width: 100%; text-align: center; }
  }
`
