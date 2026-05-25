# backend/ — FastAPI Layer

## Files
```
backend/
├── .env                    # Gitignored — copy from .env.example
├── .env.example            # Template: GEMINI_API_KEY, DATABASE_URL, CORS_ORIGINS
├── alembic.ini             # Alembic config — sqlalchemy.url injected at runtime
├── pyproject.toml          # Depends on pitchforge via uv path source (editable)
├── alembic/
│   ├── env.py              # Alembic env — converts async URL to sync for CLI
│   ├── script.py.mako      # Migration file template
│   └── versions/           # Generated migration files (committed to git)
└── app/
    ├── __init__.py
    ├── main.py             # FastAPI app, lifespan, CORS, /health
    ├── database.py         # Async engine, session factory, Base, get_db()
    ├── models.py           # SQLAlchemy ORM models (Proposal table)
    ├── runner.py           # All LangGraph invocations — only file that calls the graph
    ├── schemas.py          # Pydantic request/response models
    └── routers/
        ├── __init__.py
        └── proposals.py    # /proposals endpoints
```

---

## Database Layer

### database.py
- `engine` — async SQLAlchemy engine (`postgresql+asyncpg://`), `pool_pre_ping=True`
- `AsyncSessionLocal` — session factory, `expire_on_commit=False`
- `Base` — declarative base all models inherit from
- `get_db()` — FastAPI dependency: yields session, commits on success, rolls back on error

### models.py — `Proposal` table
Captures completed proposal runs for history and analytics. Populated in two stages:

| Stage | Fields populated |
|-------|-----------------|
| After `/analyze` | `thread_id`, `job_title`, `job_description`, `platform`, `budget`, `timeline`, `fit_score`, `suggested_price`, `matched_skills`, `missing_skills`, `recommendation` |
| After `/finalize` | `final_proposal`, `quality_score`, `iteration_count` |

Key design: `thread_id` is `unique+indexed` — enables upsert at finalize time. All output fields are `nullable=True`.

### Migrations (Alembic)
```bash
# After any models.py change — generate + apply:
cd backend
uv run alembic revision --autogenerate -m "describe_your_change"
uv run alembic upgrade head

# Check current DB state:
uv run alembic current

# Roll back one migration:
uv run alembic downgrade -1
```

Alembic's CLI uses `psycopg2-binary` (sync driver) internally. At runtime FastAPI uses `asyncpg`. The `env.py` swaps the driver prefix automatically.

---

## Runner Functions (runner.py)
All functions are **async generators** that yield SSE frames (`str`). The graph is invoked via `astream_events(version="v2")` — no sync `invoke()` calls.

| Function | Trigger | SSE events emitted |
|----------|---------|-------------------|
| `stream_analysis(job_input)` | New thread, streams to fit_checkpoint interrupt | `node_start`, `node_complete`, `interrupt`, `done` |
| `stream_generation(thread_id, should_apply)` | Resumes fit_checkpoint, streams to human_checkpoint | `node_start`, `node_complete`, `token`, `done` |
| `stream_revise(thread_id, instruction)` | Resumes human_checkpoint with feedback | `node_start`, `node_complete`, `token`, `done` |
| `stream_finalize(thread_id)` | Resumes human_checkpoint with "y", streams to END | `node_start`, `node_complete`, `done` |

### SSE Frame Format
```
event: <event_name>\ndata: <json_payload>\n\n
```
Helper: `_sse(event, data) -> str`

### Key Helpers
- `GRAPH_NODES` — set of node names to watch for `on_chain_start`/`on_chain_end`
- `NODE_LABELS` — human-readable labels per node
- `create_thread_id()` — generates UUID-based thread ID
- `_config(thread_id)` — builds LangGraph `{"configurable": {"thread_id": ...}}`
- Interrupt detection: `astream_events` ends naturally at `interrupt()` → read state with `await aget_state(config)`

---

## API Endpoints (proposals.py)
All endpoints return `StreamingResponse` with `media_type="text/event-stream"`.

| Method | Path | Handler |
|--------|------|---------|
| POST | `/proposal/analyze` | `stream_analysis` |
| POST | `/proposal/generate` | `stream_generation` |
| POST | `/proposal/revise` | `stream_revise` |
| POST | `/proposal/finalize` | `stream_finalize` |

SSE headers on all responses: `Cache-Control: no-cache`, `X-Accel-Buffering: no`

---

## Monorepo Import Setup
- `backend/pyproject.toml` declares `pitchforge = { path = "../pitchforge", editable = true }` under `[tool.uv.sources]`
- Import with `from pitchforge.X import ...`

---

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio key |
| `DATABASE_URL` | ✅ | Full asyncpg connection string |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins (default: localhost:3000,localhost:5173) |

---

## Rules
1. `runner.py` is the only file that invokes the LangGraph graph — no graph calls in routers or main
2. Routers call runner functions and handle HTTP concerns only
3. All request/response shapes live in `schemas.py`
4. All schema changes go through Alembic — never raw SQL against the DB
5. Never set `echo=True` on the engine except temporarily for debugging
6. Run with: `uv run uvicorn app.main:app --reload` from `backend/` (must use `uv run`, not bare `uvicorn`)
7. Never use `--reload` in production
8. `CORS_ORIGINS` must be set to real domain(s) in production — never `*`
