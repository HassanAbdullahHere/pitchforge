# PitchForge — Claude Code Context

## What This Is
AI pipeline that takes a job posting and produces a personalized proposal. Scores job fit, runs a generate-critique loop, then outputs a human-approved proposal. Built as a product — all changes follow the production rules below.

---

## Monorepo Structure
```
PitchForge/
├── pitchforge/        # LangGraph core pipeline  → see pitchforge/CLAUDE.md
├── backend/           # FastAPI middle layer      → see backend/CLAUDE.md
│   └── start.sh       # Container entrypoint: alembic upgrade head → uvicorn
├── frontend/          # React + Vite UI           → see frontend/CLAUDE.md
├── Dockerfile         # Multi-stage build: backend/ + pitchforge/ → one image
├── .dockerignore      # Excludes frontend/, .venv/, .env*, tests/, __pycache__/
├── docker-compose.yml # Local dev only — PostgreSQL (pgvector) container
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
| Frontend | React 18 + Vite + recharts |
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
- `GET /api/proposals` + `GET /api/proposals/{id}` — list (finalized only) and detail endpoints with ownership checks (403/404)
- Proposals history page (`/proposals`) — card grid with fit score, quality score, recommendation badges, relative timestamps
- Proposal detail page (`/proposals/:id`) — full layout: scores strip, "You Bring"/"Gaps to Bridge" skills, formatted proposal text, copy + download buttons
- Async retriever — swapped psycopg2 (sync, blocked event loop) to asyncpg pool with `pgvector.asyncpg` codec; `retrieve_profile` is now `async def`, yields event loop during both DB queries
- Sanitize error messages in `runner.py` — `logger.exception()` server-side, generic message to frontend
- Security headers middleware — pure ASGI middleware in `main.py`; X-Frame-Options, X-Content-Type-Options, CSP on all responses
- Timeout on `httpx.AsyncClient()` — 10s timeout in `auth.py`, returns 504 on `TimeoutException`
- Prompt injection guard — `pitchforge/guardrail.py` with `check_injection()`; Gemini Flash classifier, `thinking_budget=0`, `max_output_tokens=10`; blocks `stream_analysis` + `stream_revise` before any graph call; fails open on error; emits `status` SSE event immediately so stream opens before check runs
- Gemini 503 retry — `.with_retry(retry_if_exception_type=(ServerError,), stop_after_attempt=3, wait_exponential_jitter=True)` on all 5 LLM instances (analyzer, scorer, generator, critic, guardrail)
- Human revision limit — `MAX_HUMAN_REVISIONS = 2`; `revision_count` column on `Proposal` (Alembic migration `6a1b277087aa`); enforced via atomic `UPDATE ... WHERE revision_count < MAX RETURNING id` in `/revise` router (race-condition-proof — concurrent requests can't both slip through); HTTP 429 if at limit; frontend disables "Request Revision" button at limit with `(2/2)` counter; revision errors restore proposal text inline instead of full error screen
- Verifying node in AnalyzePipeline — `status` SSE event activates it; transitions to done on first `node_start`
- Rate limiting (`slowapi`) — `/analyze`: 7/day per user (DB count) + 14/day per IP; `/auth/google`: 10/hour per IP; `POST /api/profile`: 8/day IP + 4/day per-user; `POST /api/profile/parse-resume`: 4/day IP + 2/day per-user; `app/limiter.py` holds the shared `Limiter` instance
- Rate limiting IP fix — CDN/proxy-aware key function in `app/limiter.py`; checks `CF-Connecting-IP` → `X-Real-IP` (nginx) → `X-Forwarded-For` → `request.client.host`; nginx must set `proxy_set_header X-Real-IP $remote_addr`
- Per-user rate limiting key — `_get_user_id()` in `app/limiter.py`; decodes JWT Bearer token via `verify_token()`, returns `"user:{sub}"`; falls back to IP if token missing/invalid; used as `key_func` on profile endpoint `@limiter.limit` decorators
- Per-user profile system:
  - `user_profiles` table (Alembic migration) — one row per user; stores raw structured profile (title, bio, skills, projects, experience, niches, rates) as JSONB for display/edit
  - `user_id` FK on `profile_chunks` (Alembic migration) — retriever filters `WHERE user_id = $1`, each user's proposals use only their own chunks
  - `pitchforge/profile_utils.py` — `build_chunks()` shared chunking logic (bio, skills, project_N, experience_N, niches, rates keys); used by `profile_runner.py` and `setup_rag.py`
  - `GET /api/profile` + `POST /api/profile` — retrieve and upsert profile; `save_profile()` in `profile_runner.py` upserts `user_profiles`, deletes old chunks, re-embeds new ones in parallel via `asyncio.gather()`, invalidates per-user BM25 cache (`_bm25_cache.pop`)
  - `POST /api/profile/parse-resume` — PDF/DOCX extraction (pdfplumber, python-docx) + Gemini structured extraction (`max_output_tokens=2048`); returns pre-filled profile JSON, no DB write
  - Pipeline gate — `JobDetails.jsx` calls `GET /api/profile` on mount; 404 → redirect to `/profile/edit?onboarding=true`
  - Profile view (`/profile`) and form (`/profile/edit`) — shared form for onboarding + editing; resume upload drag-drop zone pre-fills all fields; section order: Identity → Skills → Specializations → Rates → Projects → Experience
  - ProfileForm UX polish — textareas auto-resize on input and on pre-fill (edit mode); "Add Project" scrolls to new card; `resize: none; overflow: hidden` + `autoResize()` JS; CSS: larger border-radius (12px/16px), tighter spacing, `box-sizing: border-box` on all inputs
  - Retriever `_pg_url()` helper — tries `DATABASE_URL` first (backend env), falls back to `DATABASE_URL_SYNC` (standalone); strips SQLAlchemy driver prefix so asyncpg gets plain `postgresql://` URL
  - ProfileForm 429/error handling — floating fixed-position toast (auto-dismiss 4.5s, click to dismiss); 429 surfaces `"Daily resume autofill limit reached"` / `"Daily profile save limit reached"`; no inline error bars; loader text is `"Autofilling…"` (not "Parsing")
- Avatar dropdown polish — Profile item moved above My Proposals; unicode placeholder icons replaced with inline SVGs (person silhouette, document list, logout arrow); entrance animation is scale+fade (`scale(0.97→1)`) via spring easing; menu width 256px
- Input validation hardening (`schemas.py`) — `thread_id` capped at `max_length=64` on all three thread request models; `level`/`platform` capped at `max_length=50` in `JobInputRequest`; `ProfileInput` list bounds: skills ≤60 items each ≤100 chars, projects ≤20, experience/niches ≤20 items each ≤200 chars (Pydantic v2 `Annotated` per-item types)
- Delete proposal — `DELETE /api/proposals/{id}` (404 if not found, 403 if wrong owner, 204 on success; hard delete); `ProposalDetail` has a Delete button in the Copy/Download action row → glass-morphism confirm modal → navigates to `/proposals` on success, inline red error banner on failure; `ProposalHistory` has a trash icon on card hover (stop-propagation) → same confirm modal → removes card from local state on success, floating toast on failure; action row wraps on mobile
- Structured logging — `pitchforge/logging_config.py` configures structlog once at FastAPI startup; pretty colored output in dev, JSON (CloudWatch-ready) in prod via `LOG_FORMAT=json` env var; all 8 pipeline nodes (`analyzer`, `retriever`, `scorer`, `generator`, `critic`, `compiler`, `fit_checkpoint`, `human_checkpoint`) migrated from `print()` to `log.info/debug/warning`; `runner.py` binds `thread_id` + `user_id` as structlog contextvars at request start so every node log line in that request carries them automatically; token usage logged at `debug` level, parse errors at `warning`; `collect_job_input()` CLI prints intentionally left as-is
- Fixed `/health` endpoint — replaced hardcoded `False` fields with real checks: `SELECT 1` for DB connectivity + `SELECT 1 FROM pg_extension WHERE extname = 'vector'` for pgvector; returns HTTP 503 when degraded (load balancers stop routing), 200 when healthy; removed stale `chromadb_connected` and `gemini_reachable` fields; response: `{"status", "db_connected", "pgvector_extension"}`
- `usage_events` table — `UsageEvent` model: `user_id` FK, `proposal_id` FK (SET NULL on delete), `phase` string, `input_tokens`, `output_tokens`, `cost_usd`, `created_at`; pipeline nodes log token usage here; preserves cost history even after proposal deletion
- Admin panel — `is_admin` bool column on `User` (Alembic migration `b9bddbbdb453`, `server_default='false'`); set manually in DB; JWT contains no `is_admin` claim — checked fresh from DB on every request via `get_admin_user` dependency (chains off `get_current_user` → 403 if not admin); banned admin gets 401 before admin check; `AdminUserPatch` only exposes `is_active` (no API surface to elevate `is_admin`); self-ban blocked (`user.id == admin.id` → 400)
  - `GET /api/admin/stats` — aggregate metrics: total users/proposals/cost/today's proposals; avg fit score, avg quality score, avg iterations, finalization rate, total revisions; 14-day time-series for proposals/cost/signups (sparse, frontend zero-fills); fit score histogram (5 buckets); recommendation breakdown; platform breakdown (`COALESCE(platform, 'Unknown')`); iteration distribution
  - `GET /api/admin/users` — all users with correlated subquery proposal count + cost; ordered by `created_at DESC`
  - `PATCH /api/admin/users/{user_id}` — ban/unban (`is_active`); self-ban blocked; returns updated `AdminUserItem`
  - `AdminRoute` component — redirects non-admins to `/`; defense-in-depth only (backend enforces)
  - Admin page (`/admin`) — two stats rows (8 cards total); 3 trend area charts (proposals/day, cost/day, signups/day, 14-day window zero-filled); 2 distribution bar charts (fit score buckets, recommendation breakdown); 2 breakdown tables (platform, iterations per proposal); existing phase token table + user management table below; `recharts` for all charts; `position: relative; z-index: 1` on `.adm-page` to render above `body::before` green gradient
  - Admin link in avatar dropdown — conditional on `user.is_admin`; above Profile entry
  - Banned user login — `google_auth` checks `is_active` before issuing JWT; raises HTTP 403 `detail="account_blocked"`; `AuthContext.login()` parses body and throws typed `"account_blocked"` error; `Landing.jsx` catches it and shows centered red toast (`left:0; right:0; margin:0 auto; width:fit-content` — transform-free centering)
- Backend test suite — `pytest` + `pytest-asyncio` (`asyncio_mode=auto`); 48 tests, 5.6s; `tests/unit/` (jwt_utils, limiter, schemas — no DB) + `tests/integration/` (auth, proposals, profile, admin, health — real `pitchforge_test` DB); `NullPool` + session rollback for isolation; `_null_lifespan` bypasses LangGraph/AsyncPostgresSaver setup; `app.dependency_overrides[get_db]` injects test session; `profile_runner.save_profile` + `profile_runner.parse_resume` mocked to avoid Gemini calls; run: `cd backend && uv run pytest tests/ -v`; requires `pitchforge_test` DB with pgvector extension

- Frontend test suite — `vitest` + `@testing-library/react` + `jsdom`; 22 tests, ~4s; `src/__tests__/context/` (AuthContext — session restore, login, logout, account_blocked), `src/__tests__/components/` (ProtectedRoute, AdminRoute — loading/redirect/render), `src/__tests__/pages/` (JobDetails — profile-404 redirect, form validation; ProfileForm — file type, file size, resume pre-fill, API error toast); `useAuth` mocked with `vi.mock` for component tests; real `AuthProvider` + mocked `global.fetch` for context tests; `fireEvent.change` on hidden file input for upload tests; run: `cd frontend && npm test`

- Docker containerization — `Dockerfile` (multi-stage, repo root), `.dockerignore`, `backend/start.sh` (entrypoint); `main.py` `load_dotenv()` guarded by `APP_ENV != production`; image bundles `backend/` + `pitchforge/` together; `uv sync --frozen --no-dev` in builder stage; runtime stage has no build tools

**Next (in order):**

*Deployment — Manual AWS (in progress)*
1. ✅ Test Docker build locally — `docker build -t pitchforge-backend .` then `docker run` against local DB
2. ✅ Create ECR repository → push image
3. ✅ AWS Console: VPC → subnets → IGW → route tables → security groups → IAM role → Secrets Manager
4. ✅ RDS db.t4g.micro PostgreSQL 18 — pgvector already included (no manual enable needed)
5. ✅ EC2 t3.small — launched, Elastic IP attached, IAM instance profile attached
6. ✅ SSH into EC2 — installed Docker, pulled from ECR, ran container, configured nginx + certbot; backend live at `https://api.pitchforge.cloud`
7. Vercel — connect `frontend/`, set `VITE_API_URL` + `VITE_GOOGLE_CLIENT_ID`
8. Google Console — add `https://pitchforge.cloud` to authorized origins + redirect URIs

*Deployment — Automation (after manual works)*
- GitHub Actions workflow — test → build → push to ECR → deploy to EC2 on every push to main
- Terraform — IaC for all AWS resources (VPC, EC2, RDS, ECR, Secrets Manager, IAM); state in S3 + DynamoDB lock

---

## Deployment

### Target Infrastructure
| Layer | Service |
|-------|---------|
| Backend container | EC2 t3.small — Docker runs directly, no ECS; Elastic IP `<ec2-elastic-ip>` |
| Database | RDS db.t4g.micro PostgreSQL 18 + pgvector (Single-AZ, ap-south-1b) |
| Container registry | ECR — one repo: `pitchforge-backend` (`<aws-account-id>.dkr.ecr.ap-south-1.amazonaws.com/pitchforge-backend`) |
| Secrets | AWS Secrets Manager — `/pitchforge/backend` secret |
| Frontend | Vercel — React + Vite static build |
| Region | ap-south-1 (Mumbai) |
| Domain | `pitchforge.cloud` (Namecheap) — `api.pitchforge.cloud` → EC2; `pitchforge.cloud` → Vercel |

### AWS Network Layout
```
VPC 10.0.0.0/16 (pitchforge-vpc)
├── Public Subnet  10.0.0.0/20  (ap-south-1a) — EC2 + Elastic IP
├── Public Subnet  10.0.16.0/20 (ap-south-1b) — unused
├── Private Subnet 10.0.128.0/20 (ap-south-1a) — unused
└── Private Subnet 10.0.144.0/20 (ap-south-1b) — RDS lives here
```
No NAT Gateway — RDS is fully managed by AWS and does not need outbound internet.

### Security Groups
- `sg-ec2` — inbound 22 (your IP only), 80, 443 (0.0.0.0/0)
- `sg-rds` — inbound 5432 from `sg-ec2` only (never exposed to internet)

### Key Decisions
- **One Docker image** — `backend/` + `pitchforge/` bundled together; pitchforge is a library imported by the backend, not a separate service
- **Docker on EC2 directly** — not ECS/Fargate; free tier, simpler, same result at this scale
- **Multi-stage Dockerfile** — Stage 1 (builder): installs uv, runs `uv sync` to build `.venv`; Stage 2 (runtime): copies `.venv` + source only; no build tools in final image
- **Layer caching** — `pyproject.toml` + `uv.lock` copied before source code so `uv sync` is cached on every normal code push; only re-runs when deps change
- **`APP_ENV=production`** baked into image — disables `load_dotenv()` in `main.py`
- **Secrets Manager → `-e` flags** — EC2 startup script pulls secrets from Secrets Manager into shell variables, passes them to `docker run -e`; no plaintext secrets on disk
- **Migrations at container startup** — `start.sh` runs `alembic upgrade head` (no-op if nothing new) then `exec uvicorn`; `exec` ensures Docker SIGTERM goes directly to uvicorn for clean shutdown

### Container Files
- `Dockerfile` — repo root; build context includes `backend/` + `pitchforge/`
- `.dockerignore` — excludes `frontend/`, `.venv/`, `.env*`, `tests/`, `__pycache__/`
- `backend/start.sh` — container entrypoint: `alembic upgrade head` → `uvicorn` (calls binaries directly from `.venv/bin`, not via `uv run`)

### EC2 Files
- `~/run-backend.sh` — pulls secrets from Secrets Manager, runs `docker run` with `-e` flags; run after every redeploy
- `/etc/nginx/sites-available/pitchforge` — nginx config: port 80/443 → proxy to localhost:8000; `proxy_buffering off` for SSE; `X-Real-IP` for rate limiting; certbot manages SSL
- SSL cert: `/etc/letsencrypt/live/api.pitchforge.cloud/` — auto-renews via certbot systemd timer

### Build + Run (Manual)
```bash
# Build image (from repo root)
docker build -t pitchforge-backend .

# Run locally for testing (requires local DB running)
docker run -d --name backend \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://postgres:password@host.docker.internal:5432/pitchforge \
  -e GEMINI_API_KEY=... \
  -e JWT_SECRET_KEY=... \
  -e GOOGLE_CLIENT_ID=... \
  -e LOG_FORMAT=json \
  pitchforge-backend:latest

# On EC2 — pull from ECR and run
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ecr-url>
docker pull <ecr-url>/pitchforge-backend:latest
docker stop backend && docker rm backend
docker run -d --name backend -p 8000:8000 -e ... pitchforge-backend:latest
```

### Deployment Order (Manual First)
```
1.  VPC + subnets + IGW + route tables
2.  Security groups (sg-ec2, sg-rds)
3.  IAM role + instance profile (secretsmanager:GetSecretValue)
4.  Secrets Manager — create /pitchforge/backend secret
5.  RDS — create instance, run CREATE EXTENSION vector manually
6.  ECR — create repository
7.  Build Docker image locally → push to ECR
8.  EC2 — launch t2.micro, attach Elastic IP + IAM profile
9.  SSH in → install Docker → pull from ECR → docker run
10. nginx + certbot (SSL on port 443 → proxy to 8000)
11. Alembic runs automatically on first container start
12. Vercel — connect frontend/, set VITE_API_URL + VITE_GOOGLE_CLIENT_ID
```

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

# 3. FastAPI backend
cd backend && uv run uvicorn app.main:app --reload

# 4. Frontend
cd frontend && npm run dev

# Dev seed only (optional — seeds profile_chunks from pitchforge/profile/profile.json for a specific user_id)
cd pitchforge && uv run python setup_rag.py
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
4. Secret upgrade path: local `.env` → AWS Secrets Manager (production) — EC2 pulls via IAM role at container start, passes as `-e` flags to `docker run`

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
