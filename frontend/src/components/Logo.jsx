export default function Logo({ onClick }) {
  return (
    <div className="pf-logo" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onClick ? 'pointer' : 'default' }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 10, flexShrink: 0 }}>
        <rect width="28" height="28" rx="10" fill="#14141F" />
        <rect x="0.5" y="0.5" width="27" height="27" rx="9.5" stroke="rgba(244,241,232,0.12)" />
        {/* Trend line */}
        <polyline
          points="5,20 10,15 15,17 20,9"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Peak dot */}
        <circle cx="20" cy="9" r="2.2" fill="#c9a84c" />
      </svg>
      <span style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: 16,
        letterSpacing: '-0.02em',
        color: '#f4f2f0',
        userSelect: 'none',
      }}>
        <span style={{ fontWeight: 600 }}>Pitch</span>
        <span style={{ fontWeight: 400 }}>Forge</span>
      </span>
    </div>
  )
}
