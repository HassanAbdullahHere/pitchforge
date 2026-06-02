# Frontend

## Stack

React 18 + Vite · React Router v6 · `Instrument Sans` · Pure CSS glass-morphism · `@react-oauth/google`

---

## Pages

| Route | Page | Protected | Description |
|-------|------|:---------:|------------|
| `/` | Landing | — | Hero · Google sign-in · "How It Works" · usage stats in avatar dropdown |
| `/new` | Job Details | ✓ | Job form — title, description, platform, level, budget, timeline. Redirects to profile onboarding if no profile saved. |
| `/analyze` | Analyze Pipeline | ✓ | Live node animation · fit score meter + matched / missing skills |
| `/generate` | Generate Proposal | ✓ | Token-streaming draft · approve / revise loop · revision counter `(n/2)` |
| `/proposals` | Proposal History | ✓ | Card grid · fit + quality score badges · relative timestamps · per-card delete |
| `/proposals/:id` | Proposal Detail | ✓ | Scores strip · skills columns · formatted proposal · copy / download / delete |
| `/profile` | Profile View | ✓ | Structured profile display — title, bio, skills, projects, niches, rates |
| `/profile/edit` | Profile Form | ✓ | Full editor with resume drag-drop autofill · onboarding mode |

---

## UX Highlights

- Pipeline nodes animate idle → pulsing → done as SSE frames arrive
- Circular SVG fit score meter: green ≥ 70 · amber ≥ 40 · red < 40
- Proposal renders word-by-word via token stream
- Revision button disables at limit with live `(2/2)` counter
- Resume drag-drop autofills every profile field via Gemini extraction
- Textareas auto-resize on input and on form pre-fill
- 4.5-second auto-dismiss toasts for copy success · save errors · rate limit hits
- Avatar dropdown: usage progress bar · SVG icons · scale-fade entrance animation

---

## Auth Flow

The frontend stores the JWT in `localStorage`. On every protected page, the auth context validates the token and redirects to `/` if missing or expired. After Google OAuth, the backend returns a JWT — no session cookies.

**First-time users** are redirected to `/profile/edit?onboarding=true` automatically. The pipeline gate (`/new`) checks `GET /api/profile` on mount and redirects if no profile exists.

---

## Profile Onboarding

1. User signs in → redirected to `/profile/edit?onboarding=true`
2. Fill form manually **or** drop a PDF/DOCX resume to autofill all fields
3. Save → profile chunks embedded in parallel (BM25 + pgvector)
4. Redirected to `/new` — pipeline is now ready to use

The resume autofill calls `POST /api/profile/parse-resume` (rate limited: 4/day IP · 2/day user). No DB write happens until the user explicitly saves the form.
