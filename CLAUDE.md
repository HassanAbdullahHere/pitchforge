# PitchForge — Claude Code Context

## What This Is
AI pipeline that takes a job posting (Upwork, Freelancer, etc.) and produces a personalized proposal. Uses RAG to pull relevant experience, scores job fit, generates a draft, critiques and refines in a loop, then outputs a final approved proposal.

Built as a **product** — all changes must follow the production rules at the bottom of this file.

---

## Monorepo Structure
```
PitchForge/
├── pitchforge/        # LangGraph core pipeline  → see pitchforge/CLAUDE.md
├── backend/           # FastAPI middle layer      → see backend/CLAUDE.md
├── frontend/          # React + Vite UI           → see frontend/CLAUDE.md
├── docker-compose.yml # PostgreSQL (pgvector) container
├── .env.example       # Docker Compose env var template
└── CLAUDE.md
```

---

## Stack
| Layer | Tech |
|-------|------|
| Orchestration | LangGraph |
| LLM | Gemini 2.5 Flash |
| Embeddings | Google gemini-embedding-2-preview |
| Vector store | pgvector (PostgreSQL extension) — `profile_chunks` table, 3072-dim |
| Retrieval | Hybrid BM25 + vector, RRF fusion, FlashRank re-ranking |
| LLM wrapper | LangChain Google GenAI |
| Database | PostgreSQL 16 via Docker (`pgvector/pgvector:pg16`) |
| ORM | SQLAlchemy 2.0 (async) + asyncpg driver |
| Migrations | Alembic |
| Backend | FastAPI |
| Frontend | React 18 + Vite |
| Dependency mgmt | uv (Python), npm (JS) |

---

## Pipeline Flow
```
analyzer → retriever → scorer → fit_checkpoint
                                      ↓
                             [interrupt: apply? y/n]
                              /               \
                            "n"              "y"
                             ↓                ↓
                            END           generator → critic
                                               ↓
                               score>=70 OR iter>=3 OR is_human_revision?
                                /                          \
                              YES                          NO
                                ↓                          ↓
                         human_checkpoint             generator (loop)
                                ↓
                   [interrupt: "y" approve or type feedback]
                    /                        \
                  "y"                   feedback text
                    ↓                        ↓
                   END              generator → critic → human_checkpoint
                                         ← loop repeats ←
```

---

## State Schema
```python
class PitchforgeState(TypedDict):
    job_posting: str
    job_analysis: dict
    profile_matches: list
    proposal_draft: str
    critic_feedback: str
    iteration_count: int
    quality_score: int
    fit_score: int
    suggested_price: str
    matched_skills: list
    missing_skills: list
    clarifying_questions: list
    final_proposal: str
    should_apply: bool
    human_approved: bool
    human_feedback: str
    is_human_revision: bool
    client_info: Optional[str]  # not yet used
```

---

## Build Status
| Status | Item |
|--------|------|
| ✅ | Nodes 1–7 (analyzer, retriever, scorer, fit_checkpoint, generator, critic, human_checkpoint, compiler) |
| ✅ | graph.py — full StateGraph wiring |
| ✅ | backend runner.py — async SSE streaming via `astream_events` |
| ✅ | backend schemas.py |
| ✅ | backend routers/proposals.py + main.py |
| ✅ | PostgreSQL container (Docker) + pgvector image |
| ✅ | SQLAlchemy async engine + session factory (`database.py`) |
| ✅ | `proposals` table + Alembic migrations wired |
| ✅ | ChromaDB → pgvector migration — `profile_chunks` table, 3072-dim embeddings |
| ✅ | Frontend: Landing page (`/`) |
| ✅ | Frontend: Job Details form (`/new`) — with enhanced validation |
| ✅ | Frontend: Analysis Pipeline page (`/analyze`) — animated pipeline + fit score result |
| ✅ | Frontend: Generate Proposal page (`/generate`) — token streaming + approve/revise flow |
| ✅ | Auth: Google OAuth + JWT — `users` table, `jwt_utils.py`, `deps.py`, `/api/auth/google` + `/api/auth/me` |
| ✅ | Auth: Frontend — `AuthContext.jsx`, `Login.jsx` (`useGoogleLogin` hook), `ProtectedRoute.jsx` |
| ✅ | Auth: All proposal endpoints locked behind `get_current_user` dependency |
| ✅ | Auth: Navbar Google sign-in button + avatar dropdown (name, email, sign out) on Landing page |
| 🔜 | Wire `proposals` table to pipeline (save runs to DB, link to user) |
| 🔜 | PostgreSQL checkpointer — replace `MemorySaver` in `graph.py` (threads die on server restart) |
| 🔜 | Rate limiting — `slowapi` on proposal endpoints (per-user, before public launch) |
| 🔜 | Usage events — `usage_events` table + per-user request tracking |

---

## Token Cost Profile
Gemini 2.5 Flash — non-thinking mode (`thinking_budget=0` on all nodes):
- Input: $0.075/1M tokens · Output: $0.30/1M tokens
- Typical run (2 auto-iterations): ~$0.0013
- Worst-case auto run (3 iterations): ~$0.0019
- With 2 human revisions: ~$0.0027

Key optimisations: thinking disabled, per-node output caps, critic no longer receives profile chunks (saves ~1,800 tokens/critic call).

---

## How to Run

### Prerequisites
- Docker Desktop running
- `uv` installed (Python), `npm` installed (JS)

```bash
# 1. Start the database (first time or after docker-compose down)
docker-compose up -d

# 2. One-time RAG setup (only if pitchforge/chromadb/ doesn't exist)
cd pitchforge && uv run setup_rag.py

# 3. Apply DB migrations (first time or after schema changes)
cd backend && uv run alembic upgrade head

# 4. FastAPI backend
cd backend && uv run uvicorn app.main:app --reload

# 5. Frontend dev server
cd frontend && npm run dev
```

---

## Environment Variables

Each layer has its own `.env` (gitignored). Copy from `.env.example` to get started.

| File | Variables |
|------|-----------|
| `.env` (root) | `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` — Docker Compose |
| `backend/.env` | `GEMINI_API_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `GOOGLE_CLIENT_ID`, `JWT_SECRET_KEY` |
| `pitchforge/.env` | `GEMINI_API_KEY` |
| `frontend/.env` | `VITE_GOOGLE_CLIENT_ID` |

### Auth Notes
- `JWT_SECRET_KEY` — random 256-bit hex secret used to sign JWTs. Never sent to clients. Changing it invalidates all existing tokens.
- `GOOGLE_CLIENT_ID` — used by both frontend (`VITE_GOOGLE_CLIENT_ID`) for the OAuth popup, and backend for reference (not strictly used at runtime — userinfo is verified via Google's userinfo endpoint).
- Token expiry: 7 days. Users are logged out after expiry; no silent refresh (acceptable for v1).
- Token revocation: setting `user.is_active = False` in the DB bans a user immediately (checked in `get_current_user`). Full JWT blacklist not built yet.

---

## Production Rules

These rules apply to every change in this codebase. This is a product, not a prototype.

### Secrets & Config
1. **Never hardcode credentials, API keys, or URLs** in source code — always use environment variables via `os.getenv()` or `os.environ`
2. **Never commit `.env` files** — they are gitignored; provide `.env.example` with placeholder values
3. **Never hardcode `localhost`** in runtime code — use env vars for service URLs (CORS origins, DB host, etc.)
4. All secrets in `.env.example` must use placeholder values like `your_key_here`, never real values
5. **Secret management upgrade path** — local `.env` is fine for dev; use platform env vars (Render/Railway dashboard) for first deploy; migrate to Doppler or Infisical when the team grows or multiple environments are needed

### Database
5. **All schema changes must go through Alembic** — never run raw `ALTER TABLE` or `CREATE TABLE` manually against the DB
6. Every model change = new migration: `alembic revision --autogenerate -m "describe_change"` then `alembic upgrade head`
7. Migrations must be reversible — always implement `downgrade()` in migration files
8. Never set `echo=True` on the SQLAlchemy engine in production — it logs all SQL including values

### Code Quality
9. **No `--reload` flag in production** — only use it in dev (`uv run uvicorn app.main:app --reload`)
10. All new API endpoints must have a corresponding Pydantic request/response model in `schemas.py`
11. No business logic in routers — routers call runner functions only
12. No direct graph calls outside `runner.py`

### Dependencies
13. Always use `uv` (not `pip`) for Python dependency management in this project
14. Pin new dependencies with minimum version (`>=`) not exact (`==`) to allow patch updates
15. Run `uv sync` after any `pyproject.toml` change
