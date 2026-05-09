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
        └── Landing.jsx   # Entry page — hero, sparks, process strip, CTA
```

## Pages
| Route | File | Status |
|-------|------|--------|
| `/` | `pages/Landing.jsx` | ✅ done |
| `/app` | *(todo)* | ⬜ job input + proposal flow |

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
