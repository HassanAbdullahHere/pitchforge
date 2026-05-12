# frontend/ — React + Vite Layer

## Stack
- React 18 + React Router v6
- Vite 5
- CSS-in-component (style template literals) — no CSS framework
- Fonts: Cormorant Garamond (display), JetBrains Mono (mono) via Google Fonts

## Files
```
frontend/
├── package.json
├── vite.config.js       # Dev server on :5173, proxies /api → localhost:8000
├── index.html           # Loads Google Fonts, mounts #root
└── src/
    ├── main.jsx
    ├── App.jsx           # BrowserRouter + Routes
    └── pages/
        ├── Landing.jsx           # Entry page — hero, sparks, process strip, CTA
        ├── JobDetails.jsx        # Job form with enhanced validation → navigates to /analyze
        ├── AnalyzePipeline.jsx   # SSE streaming pipeline animation + fit score result card
        └── GenerateProposal.jsx  # Proposal generation — token streaming + approve/revise flow
```

## Pages
| Route | File | Status |
|-------|------|--------|
| `/` | `pages/Landing.jsx` | ✅ done |
| `/new` | `pages/JobDetails.jsx` | ✅ done — validated form, passes `{ form }` state to `/analyze` |
| `/analyze` | `pages/AnalyzePipeline.jsx` | ✅ done — animated pipeline + fit score + Generate/Cancel |
| `/generate` | `pages/GenerateProposal.jsx` | ✅ done — token streaming, approve/revise flow |

## SSE Consumption Pattern
Backend uses POST endpoints, so `EventSource` (GET-only) cannot be used. `GenerateProposal.jsx` uses a shared `readSSE` helper:
```javascript
// readSSE captures and returns the final 'done' payload
const doneData = await readSSE(url, payload, onEvent, signal)
// set quality / final data from doneData AFTER the stream resolves — never from inside onEvent
```

Raw reader loop used in `AnalyzePipeline.jsx`:
```javascript
const res = await fetch('/api/proposal/...', { method: 'POST', body: JSON.stringify(payload), signal: ctrl.signal })
const reader = res.body.getReader()
const dec = new TextDecoder()
let buf = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buf += dec.decode(value, { stream: true })
  const frames = buf.split('\n\n')
  buf = frames.pop()   // keep incomplete last frame
  for (const frame of frames) { /* parse event + data lines */ }
}
```

## StrictMode
`<StrictMode>` is intentionally **removed** from `main.jsx`. StrictMode double-invokes every `useEffect` in development, which caused two simultaneous SSE connections per page load — both hitting the same LangGraph thread and burning double tokens. Without StrictMode, `useEffect(() => {...}, [])` fires exactly once. The `AbortController` cleanup still handles navigation-away correctly.

## JobDetails Validation Rules
| Field | Rule |
|-------|------|
| `title` | required, 5–150 chars |
| `description` | required, min 150 chars |
| `budget` | optional — if non-empty must be a positive number |
| `timeline` | optional — if non-empty must be a positive number |

Budget and timeline values are combined with their unit dropdowns before sending to the API (e.g. `"500 USD"`, `"2 weeks"`).

## Design System
All defined as CSS custom properties in `Landing.jsx` (and future pages):
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

## API
Backend runs on `http://localhost:8000`. Vite proxies `/api/*` → backend, so all fetch calls use `/api/...` — no hardcoded ports in component code.

## Rules
1. Each page owns its styles as a `css` template literal passed to a `<style>` tag — no separate `.css` files unless the project grows to need them
2. Never hardcode `localhost:8000` in components — always use relative `/api/` paths
3. New pages go in `src/pages/`, shared components in `src/components/` (create when needed)
4. Run with: `npm run dev` from `frontend/`
