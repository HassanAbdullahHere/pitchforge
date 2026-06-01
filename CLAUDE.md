# PitchForge — Claude Code Context

## What This Is
AI pipeline that takes a job posting and produces a personalized proposal. Scores job fit, runs a generate-critique loop, then outputs a human-approved proposal. Built as a product — all changes follow the production rules below.

---

## Monorepo Structure
```
PitchForge/
├── pitchforge/        # LangGraph core pipeline  → see pitchforge/CLAUDE.md
├── backend/           # FastAPI middle layer      → see backend/CLAUDE.md
├── frontend/          # React + Vite UI           → see frontend/CLAUDE.md
├── docker-compose.yml # PostgreSQL (pgvector) container
└── .env.example       # Docker Compose env vars
```

---

## Stack
| Layer | Tech |
|-------|------|
| Orchestration | LangGraph |
| LLM | Gemini 2.5 Flash (`thinking_budget=0` on all nodes) |
| Embeddings | `gemini-embedding-2-preview` — 3072-dim |
| Vector store | pgvector — `profile_chunks` table |
| Retrieval | Hybrid BM25 + pgvector → RRF fusion → FlashRank re-ranking |
| LLM wrapper | LangChain Google GenAI |
| Database | PostgreSQL 16 via Docker (`pgvector/pgvector:pg16`) |
| ORM | SQLAlchemy 2.0 async + asyncpg |
| Graph checkpointer | `langgraph-checkpoint-postgres` (`AsyncPostgresSaver`) — psycopg3 pool |
| Migrations | Alembic |
| Backend | FastAPI |
| Frontend | React 18 + Vite |
| Deps | uv (Python), npm (JS) |

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
                              score>=85 OR iter>=3 OR is_human_revision?
                                /                          \
                              YES                          NO
                                ↓                          ↓
                         human_checkpoint             generator (loop)
                                ↓
                   [interrupt: "y" approve or type feedback]
                    /                        \
                  "y"                   feedback text
                    ↓                        ↓
                  compiler → END    generator → critic → human_checkpoint
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
    client_info: Optional[str]
```

---

## What's Built vs What's Next
**Done:**
- All 8 pipeline nodes + graph wiring
- Async SSE streaming backend (runner.py)
- PostgreSQL + pgvector (Docker), Alembic migrations
- `proposals`, `users`, `profile_chunks` tables
- Hybrid RAG (BM25 + pgvector + RRF + FlashRank)
- Google OAuth + JWT — all proposal endpoints auth-gated
- Full frontend: Landing, JobDetails, AnalyzePipeline, GenerateProposal
- Code cleanup: removed dead Login.jsx, ReviseRequest, should_continue(); fixed 768→3072 comment
- `user_id` FK on `Proposal` + Alembic migration (`fk_proposals_user_id_users`)
- Proposal row created at `/analyze` (fit data), updated at `/finalize` (final proposal + scores)
- Thread ownership enforced on all proposal endpoints (403 if thread_id doesn't belong to current user)
- PostgreSQL checkpointer (`AsyncPostgresSaver`) — `graph.py` exposes `compile_graph(checkpointer)`; lifespan in `main.py` creates the pool, calls `setup()`, sets `runner.pitchforge_graph`. Checkpoint tables (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`) are self-managed by LangGraph, not Alembic. Threads survive backend restarts.
- `GET /api/proposals` + `GET /api/proposals/{id}` — list and detail endpoints with ownership checks (403/404)
- Proposals history page (`/proposals`) — card grid with fit score, quality score, recommendation badges, relative timestamps
- Proposal detail page (`/proposals/:id`) — full layout: scores strip, "You Bring"/"Gaps to Bridge" skills, formatted proposal text, copy + download buttons
- Async retriever — swapped psycopg2 (sync, blocked event loop) to asyncpg pool with `pgvector.asyncpg` codec; `retrieve_profile` is now `async def`, yields event loop during both DB queries

**Next (in order):**

*Data & persistence*
- `usage_events` table — per-user token/cost tracking (feeds rate limiting + admin) — deferred until admin panel

*Security & hardening*
- Sanitize error messages in `runner.py` — currently leaks `str(e)` to frontend, logs nothing server-side
- Security headers middleware — CSP, X-Frame-Options, X-Content-Type-Options
- Add timeout to `httpx.AsyncClient()` in `/api/auth/google` (currently can hang indefinitely)
- Guard LLM call for prompt injection — cheap Gemini Flash classifier runs before `stream_analysis` and `stream_revise` in `runner.py`; live in `pitchforge/guardrail.py`; binary output (safe/injection); blocks the request if injection detected. Covers both job description and human feedback surfaces.
- Rate limiting (`slowapi`) — per-user + per-IP on auth and proposal endpoints

*Observability*
- Structured logging — replace all `print()` with structlog JSON (nodes + runner + requests)
- Fix `/health` — remove hardcoded `False` fields, add pgvector extension check
- Admin view — `/api/admin/stats`, `is_admin` flag on `User`, protected admin page in frontend

*Tests*
- Backend: pytest + pytest-asyncio — auth flow, proposal ownership, SSE frame sequence, schema validation
- Frontend: Vitest + React Testing Library — auth context, protected routes, form validation

---

## Token Cost Profile
Gemini 2.5 Flash, thinking disabled:
- Input: $0.075/1M · Output: $0.30/1M
- Typical run (2 auto-iterations): ~$0.0013
- Worst-case (3 auto + 2 human revisions): ~$0.0027

Key savings: thinking disabled, per-node output caps, critic excludes profile chunks (~1,800 tokens/call saved).

---

## How to Run (Dev)

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Apply DB migrations
cd backend && uv run alembic upgrade head

# 3. One-time RAG setup (re-run after editing profile/profile.json)
cd pitchforge && uv run python setup_rag.py

# 4. FastAPI backend
cd backend && uv run uvicorn app.main:app --reload

# 5. Frontend
cd frontend && npm run dev
```

---

## Environment Variables

| File | Variables |
|------|-----------|
| `.env` (root) | `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` |
| `backend/.env` | `GEMINI_API_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID` |
| `pitchforge/.env` | `GEMINI_API_KEY`, `DATABASE_URL_SYNC` |
| `frontend/.env` | `VITE_GOOGLE_CLIENT_ID` |

`JWT_SECRET_KEY` — 256-bit hex. Changing it invalidates all active sessions.  
`DATABASE_URL_SYNC` — psycopg2 URL (used by setup_rag.py and Alembic CLI only; backend uses asyncpg).  
Token expiry: 7 days. `user.is_active = False` bans a user immediately.

---

## Production Rules

### Secrets & Config
1. Never hardcode credentials, API keys, or URLs — always `os.getenv()` / `os.environ`
2. Never commit `.env` files — gitignored; `.env.example` has placeholder values only
3. Never hardcode `localhost` in runtime code — use env vars for service URLs
4. Secret upgrade path: local `.env` → platform env vars (Render/Railway) → Doppler/Infisical at scale

### Database
5. All schema changes go through Alembic — never raw `ALTER TABLE`
6. Every model change: `alembic revision --autogenerate -m "..."` then `alembic upgrade head`
7. Always implement `downgrade()` in migrations
8. Never `echo=True` on the engine in production

### Code Quality
9. No `--reload` in production
10. All new endpoints need Pydantic models in `schemas.py`
11. No business logic in routers — routers call runner functions only
12. No graph calls outside `runner.py`

### Dependencies
13. Use `uv` not `pip`
14. Pin with `>=` (minimum), not `==` (exact)
15. Run `uv sync` after any `pyproject.toml` change
