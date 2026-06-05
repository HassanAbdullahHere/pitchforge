import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export default function Admin() {
  const navigate = useNavigate()
  const { user, logout, authHeaders } = useAuth()

  const [stats, setStats]   = useState(null)
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [patching, setPatching] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [sRes, uRes] = await Promise.all([
          fetch('/api/admin/stats', { headers: authHeaders() }),
          fetch('/api/admin/users', { headers: authHeaders() }),
        ])
        if (!sRes.ok || !uRes.ok) throw new Error('Failed to load admin data')
        const [s, u] = await Promise.all([sRes.json(), uRes.json()])
        setStats(s)
        setUsers(u)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleBan(u) {
    setPatching(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !u.is_active }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))
    } catch {
      // silently keep existing state
    } finally {
      setPatching(null)
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="adm-page">
        <nav className="adm-nav">
          <Logo />
          <div className="adm-nav-right">
            <button className="adm-nav-link" onClick={() => navigate('/')}>← Back</button>
            <button className="adm-nav-link adm-nav-link--danger" onClick={logout}>Sign Out</button>
          </div>
        </nav>

        <div className="adm-content">
          <h1 className="adm-title">Admin</h1>
          <p className="adm-sub">Signed in as {user?.email}</p>

          {loading && <div className="adm-loading">Loading…</div>}
          {error && <div className="adm-error">{error}</div>}

          {!loading && !error && stats && (
            <>
              {/* Stats strip */}
              <div className="adm-stats">
                <StatCard label="Total Users"      value={stats.total_users} />
                <StatCard label="Total Proposals"  value={stats.total_proposals} />
                <StatCard label="Total Cost"       value={`$${stats.total_cost_usd.toFixed(4)}`} />
                <StatCard label="Today's Proposals" value={stats.proposals_today} />
              </div>

              {/* Phase breakdown */}
              {stats.phase_breakdown.length > 0 && (
                <section className="adm-section">
                  <h2 className="adm-section-title">Token Usage by Phase</h2>
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Phase</th>
                          <th>Input Tokens</th>
                          <th>Output Tokens</th>
                          <th>Cost (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.phase_breakdown.map(p => (
                          <tr key={p.phase}>
                            <td><span className="phase-pill">{p.phase}</span></td>
                            <td>{p.total_input_tokens.toLocaleString()}</td>
                            <td>{p.total_output_tokens.toLocaleString()}</td>
                            <td>${p.total_cost_usd.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* User management */}
              <section className="adm-section">
                <h2 className="adm-section-title">Users ({users.length})</h2>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Proposals</th>
                        <th>Cost (USD)</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="user-cell">
                              <span className="user-name">{u.name}</span>
                              <span className="user-email">{u.email}</span>
                              {u.is_admin && <span className="admin-tag">admin</span>}
                            </div>
                          </td>
                          <td>{u.proposal_count}</td>
                          <td>${u.total_cost_usd.toFixed(4)}</td>
                          <td>
                            <span className={`status-badge ${u.is_active ? 'status-active' : 'status-banned'}`}>
                              {u.is_active ? 'Active' : 'Banned'}
                            </span>
                          </td>
                          <td>
                            {u.id === user?.id ? (
                              <span className="action-self">—</span>
                            ) : (
                              <button
                                className={`action-btn ${u.is_active ? 'action-btn--ban' : 'action-btn--unban'}`}
                                onClick={() => toggleBan(u)}
                                disabled={patching === u.id}
                              >
                                {patching === u.id ? '…' : u.is_active ? 'Ban' : 'Unban'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .adm-page {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    background: #0a0908;
    color: #f5f0e8;
    font-family: 'Instrument Sans', sans-serif;
  }

  .adm-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    height: 60px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .adm-nav-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .adm-nav-link {
    background: none;
    border: none;
    color: rgba(245,240,232,0.6);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    transition: color 150ms, background 150ms;
  }
  .adm-nav-link:hover { color: #f5f0e8; background: rgba(255,255,255,0.05); }
  .adm-nav-link--danger:hover { color: #e07070; }

  .adm-content {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 32px 80px;
  }

  .adm-title {
    font-size: 28px;
    font-weight: 600;
    color: #c9a84c;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
  }

  .adm-sub {
    font-size: 13px;
    color: rgba(245,240,232,0.45);
    margin-bottom: 40px;
  }

  .adm-loading, .adm-error {
    text-align: center;
    padding: 60px 0;
    color: rgba(245,240,232,0.5);
    font-size: 14px;
  }
  .adm-error { color: #e07070; }

  /* Stats strip */
  .adm-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 48px;
  }

  .stat-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat-value {
    font-size: 26px;
    font-weight: 600;
    color: #c9a84c;
    letter-spacing: -0.5px;
  }

  .stat-label {
    font-size: 12px;
    color: rgba(245,240,232,0.45);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Sections */
  .adm-section {
    margin-bottom: 48px;
  }

  .adm-section-title {
    font-size: 15px;
    font-weight: 600;
    color: rgba(245,240,232,0.8);
    margin-bottom: 16px;
    letter-spacing: -0.2px;
  }

  .adm-table-wrap {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    overflow: hidden;
  }

  .adm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .adm-table th {
    text-align: left;
    padding: 12px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(245,240,232,0.35);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .adm-table td {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: rgba(245,240,232,0.8);
    vertical-align: middle;
  }

  .adm-table tr:last-child td { border-bottom: none; }
  .adm-table tr:hover td { background: rgba(255,255,255,0.02); }

  .phase-pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(201,168,76,0.1);
    color: #c9a84c;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .user-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .user-name { color: #f5f0e8; font-weight: 500; }
  .user-email { font-size: 12px; color: rgba(245,240,232,0.4); }

  .admin-tag {
    display: inline-block;
    margin-top: 2px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(232,121,58,0.15);
    color: #e8793a;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: fit-content;
  }

  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
  }
  .status-active {
    background: rgba(122,184,122,0.12);
    color: rgba(50,180,50,0.9);
    border: 1px solid rgba(122,184,122,0.2);
  }
  .status-banned {
    background: rgba(220,80,80,0.1);
    color: rgba(200,60,60,0.9);
    border: 1px solid rgba(220,80,80,0.2);
  }

  .action-self { color: rgba(245,240,232,0.2); font-size: 13px; }

  .action-btn {
    padding: 5px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid transparent;
    transition: opacity 150ms;
  }
  .action-btn:disabled { opacity: 0.5; cursor: default; }
  .action-btn--ban {
    background: rgba(220,80,80,0.12);
    color: rgba(200,60,60,0.9);
    border-color: rgba(220,80,80,0.25);
  }
  .action-btn--ban:hover:not(:disabled) { background: rgba(220,80,80,0.2); }
  .action-btn--unban {
    background: rgba(122,184,122,0.12);
    color: rgba(50,180,50,0.9);
    border-color: rgba(122,184,122,0.25);
  }
  .action-btn--unban:hover:not(:disabled) { background: rgba(122,184,122,0.2); }

  @media (max-width: 768px) {
    .adm-stats { grid-template-columns: repeat(2, 1fr); }
    .adm-content { padding: 32px 16px 60px; }
    .adm-nav { padding: 0 16px; }
  }
`
