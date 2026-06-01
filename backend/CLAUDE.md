# backend/ — FastAPI Layer

## Files
```
backend/
├── .env                    # Gitignored — copy from .env.example
├── .env.example            # GEMINI_API_KEY, DATABASE_URL, CORS_ORIGINS, JWT_SECRET_KEY, GOOGLE_CLIENT_ID
├── alembic.ini
├── pyproject.toml          # Depends on pitchforge via uv path source (editable)
├── alembic/
│   ├── env.py              # Swaps asyncpg → psycopg2 URL for Alembic CLI
│   ├── script.py.mako
│   └── versions/           # 3 migrations: proposals, profile_chunks, users
└── app/
    ├── main.py             # FastAPI app, lifespan, CORS, /health
    ├── database.py         # Async engine, session factory, Base, get_db()
    ├── models.py           # ORM models: Proposal, User, ProfileChunk
    ├── schemas.py          # Pydantic request/response models
    ├── deps.py             # get_current_user dependency
    ├── jwt_utils.py        # create_token / verify_token (HS256, 7-day expiry)
    ├── runner.py           # All LangGraph invocations — only file that calls the graph
    └── routers/
        ├── auth.py         # POST /auth/google, GET /auth/me
        └── proposals.py    # POST /proposal/{analyze,generate,revise,finalize}
```

---

## Models (`models.py`)

### `users` table
Created on first Google login. `google_id` is stable (never changes). `is_active=False` bans immediately.

### `proposals` table
**Current state: model exists, runner does not write to it yet.**  
Designed for two-stage population:

| Stage | Fields |
|-------|--------|
| After `/analyze` | `thread_id`, `user_id`*, job fields, fit_score, suggested_price, matched/missing skills, recommendation |
| After `/finalize` | `final_proposal`, `quality_score`, `iteration_count` |

`thread_id` is `unique+indexed` — enables upsert at finalize time.  
`user_id` FK → `users.id` — **not yet added; next migration required**.

### `profile_chunks` table
8 embedded profile sections. `Vector(3072)` — Gemini `gemini-embedding-2-preview` output dimension.

---

## Alembic
```bash
cd backend
uv run alembic revision --autogenerate -m "describe_change"
uv run alembic upgrade head
uv run alembic current       # check state
uv run alembic downgrade -1  # roll back one
```
`env.py` auto-converts `postgresql+asyncpg://` → `postgresql+psycopg2://` for CLI. Always implement `downgrade()`.

---

## Auth Flow
1. Frontend: `useGoogleLogin` hook → Google `access_token`
2. Frontend: `POST /api/auth/google` with `access_token`
3. Backend: calls Google userinfo endpoint to verify + get user details
4. Backend: upserts `User` row, returns signed JWT
5. Frontend: stores JWT in `localStorage`, sends as `Authorization: Bearer <token>` on every request
6. `get_current_user` dep in `deps.py` validates JWT + loads User on every protected endpoint

---

## Runner (`runner.py`)
Only file that calls `pitchforge_graph`. All functions are async generators yielding SSE frames.

| Function | Graph action | SSE events |
|----------|-------------|-----------|
| `stream_analysis(job_input)` | New thread → runs to fit_checkpoint interrupt | `node_start`, `node_complete`, `interrupt`, `done` |
| `stream_generation(thread_id, should_apply)` | Resumes fit_checkpoint → human_checkpoint interrupt | `node_start`, `node_complete`, `token`, `done` |
| `stream_revise(thread_id, instruction)` | Resumes human_checkpoint with feedback | `node_start`, `node_complete`, `token`, `done` |
| `stream_finalize(thread_id)` | Resumes human_checkpoint with "y" → END | `node_start`, `node_complete`, `done` |

SSE frame: `event: <name>\ndata: <json>\n\n` via `_sse(event, data)`.  
`token` events are emitted only during `generator` node (`on_chat_model_stream`).  
Exceptions: currently leak `str(e)` to frontend and log nothing — **pending structured logging**.

---

## API Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/google` | none | Exchanges Google token for JWT |
| GET | `/api/auth/me` | JWT | Returns current user profile |
| GET | `/api/proposals` | JWT | Lists finalized proposals for current user (final_proposal IS NOT NULL) |
| GET | `/api/proposals/{id}` | JWT | Proposal detail — 403 if not owner, 404 if not found |
| POST | `/api/proposal/analyze` | JWT | Starts new thread, streams fit analysis |
| POST | `/api/proposal/generate` | JWT | Resumes thread, streams generation |
| POST | `/api/proposal/revise` | JWT | Resumes with feedback, streams revision (limit: 2/proposal) |
| POST | `/api/proposal/finalize` | JWT | Approves, streams to END |

All proposal endpoints return `StreamingResponse(media_type="text/event-stream")` with `Cache-Control: no-cache`, `X-Accel-Buffering: no`.  
`thread_id` ownership enforced on all proposal endpoints — 403 if thread doesn't belong to current user.

---

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio key |
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://...` — used by FastAPI at runtime |
| `JWT_SECRET_KEY` | ✅ | 256-bit hex secret — changing it invalidates all sessions |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `CORS_ORIGINS` | optional | Comma-separated origins (default: localhost:3000,localhost:5173) |

---

## Rules
1. `runner.py` is the only file that invokes the graph — no graph calls in routers or main
2. Routers handle HTTP concerns only — call runner functions, return responses
3. All request/response shapes in `schemas.py`
4. All schema changes via Alembic — never raw SQL
5. Never `echo=True` on the engine in production
6. Run: `uv run uvicorn app.main:app --reload` from `backend/` — never bare `uvicorn`
7. `CORS_ORIGINS` must be real domain(s) in production
