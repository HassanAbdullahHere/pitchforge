# frontend/ — React + Vite Layer

## Stack
- React 18 + React Router v6
- Vite 5
- CSS-in-component (style template literals) — no CSS framework
- Fonts: Cormorant Garamond (display), JetBrains Mono (mono) via Google Fonts

## Files
```
frontend/
├── .env.example            # VITE_GOOGLE_CLIENT_ID, VITE_API_BASE_URL
├── package.json
├── vite.config.js          # Dev server :5173, proxies /api → localhost:8000
├── index.html
└── src/
    ├── main.jsx            # GoogleOAuthProvider + AuthProvider — no StrictMode (see below)
    ├── App.jsx             # BrowserRouter + 4 routes
    ├── context/
    │   └── AuthContext.jsx # useAuth() — JWT storage, login/logout, authHeaders()
    ├── components/
    │   ├── Logo.jsx        # Reusable SVG logo
    │   └── ProtectedRoute.jsx  # Redirects to / if not authenticated
    └── pages/
        ├── Landing.jsx           # Hero, process strip, Google sign-in, avatar dropdown
        ├── JobDetails.jsx        # Job form with validation — navigates to /analyze
        ├── AnalyzePipeline.jsx   # SSE streaming pipeline animation + fit score result
        └── GenerateProposal.jsx  # Token streaming, approve/revise loop, finalize
```

`Login.jsx` exists but is not routed — auth happens on Landing. It can be deleted.

---

## Routes
| Route | Page | Protected |
|-------|------|-----------|
| `/` | Landing.jsx | No |
| `/new` | JobDetails.jsx | Yes |
| `/analyze` | AnalyzePipeline.jsx | Yes |
| `/generate` | GenerateProposal.jsx | Yes |

---

## Auth (`AuthContext.jsx`)
- On mount: reads JWT from `localStorage`, calls `/api/auth/me` to restore session
- `login(googleAccessToken)`: exchanges Google token for backend JWT, stores in `localStorage`
- `authHeaders()`: returns `{ Authorization: "Bearer <token>" }` for fetch calls
- `logout()`: clears localStorage, resets user state

---

## SSE Consumption
Backend uses POST, so `EventSource` (GET-only) cannot be used. Two patterns:

**AnalyzePipeline** — raw reader loop:
```javascript
const res = await fetch('/api/proposal/analyze', { method: 'POST', body: JSON.stringify(payload), signal })
const reader = res.body.getReader()
let buf = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buf += dec.decode(value, { stream: true })
  const frames = buf.split('\n\n')
  buf = frames.pop()
  for (const frame of frames) { /* parse event + data */ }
}
```

**GenerateProposal** — `readSSE(url, payload, onEvent, signal)` helper:
```javascript
// onEvent fires for every frame during streaming
// readSSE returns the final 'done' payload after stream closes
const doneData = await readSSE(url, payload, onEvent, signal)
// update UI state from doneData — not from inside onEvent
```

---

## StrictMode
Intentionally removed from `main.jsx`. StrictMode double-invokes `useEffect` in dev, which caused two simultaneous SSE connections per page load — both hitting the same LangGraph thread. `AbortController` cleanup on unmount still works correctly.

---

## JobDetails Validation
| Field | Rule |
|-------|------|
| `title` | required, 5–150 chars, 3+ words |
| `description` | required, 150–8000 chars |
| `budget` | optional — if non-empty, must be a positive number |
| `timeline` | optional — if non-empty, must be a positive number |

Budget and timeline are combined with unit dropdowns before sending (e.g. `"500 USD"`, `"2 weeks"`).

---

## Design System
CSS custom properties defined in `Landing.jsx`, reused across pages:
```css
--bg:           #0a0908   /* near-black warm */
--gold:         #c9a84c   /* burnished gold — primary accent */
--gold-dim:     #8a6d2e   /* muted gold */
--fire:         #e8793a   /* forge orange — emphasis */
--ivory:        #f5f0e8   /* warm white — body text */
--ivory-dim:    #9c9389   /* muted text */
--font-display: 'Cormorant Garamond'
--font-mono:    'JetBrains Mono'
```

---

## API
Dev: Vite proxies `/api/*` → `http://localhost:8000`. All fetch calls use relative `/api/` paths.  
Production: set `VITE_API_BASE_URL` and update `vite.config.js` proxy target.  
Never hardcode `localhost:8000` in component code.

---

## Rules
1. Each page owns its styles as a `css` template literal — no separate `.css` files
2. All fetch calls use relative `/api/` paths — never hardcoded backend URLs
3. New pages → `src/pages/`, shared UI → `src/components/`
4. Run: `npm run dev` from `frontend/`
5. Never commit real API keys or backend URLs — use `VITE_*` env vars
