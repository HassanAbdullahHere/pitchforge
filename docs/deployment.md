# Deployment

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [uv](https://docs.astral.sh/uv/) — Python package manager
- Node.js 18+

---

## Environment Variables

Four `.env` files — none are committed. Copy `.env.example` from the repo root and fill in your values.

| File | Variable | Description |
|------|----------|-------------|
| `.env` (root) | `DB_USER` | PostgreSQL username |
| | `DB_PASSWORD` | PostgreSQL password |
| | `DB_NAME` | Database name |
| | `DB_PORT` | PostgreSQL port (default: `5432`) |
| `backend/.env` | `GEMINI_API_KEY` | Google AI Studio API key |
| | `DATABASE_URL` | asyncpg URL — `postgresql+asyncpg://user:pass@host/db` |
| | `CORS_ORIGINS` | Comma-separated allowed origins — e.g. `http://localhost:5173` |
| | `JWT_SECRET_KEY` | 256-bit hex string — generate with `openssl rand -hex 32` |
| | `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `pitchforge/.env` | `GEMINI_API_KEY` | Same key as backend |
| | `DATABASE_URL_SYNC` | psycopg2 URL — `postgresql://user:pass@host/db` (used by Alembic CLI only) |
| `frontend/.env` | `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth client ID |

> **JWT_SECRET_KEY:** Changing this value invalidates all active user sessions immediately.

---

## Local Setup

```bash
# 1 — Start PostgreSQL
docker-compose up -d

# 2 — Apply DB migrations
cd backend && uv run alembic upgrade head

# 3 — Start backend (dev mode)
cd backend && uv run uvicorn app.main:app --reload

# 4 — Start frontend
cd frontend && npm run dev
```

The backend runs on `http://localhost:8000` and the frontend on `http://localhost:5173` by default.

---

## Production Checklist

Before routing real traffic, verify each of the following:

- [ ] **Remove `--reload`** from the uvicorn command — it's a dev-only flag
- [ ] **Set `LOG_FORMAT=json`** in `backend/.env` — enables structured JSON logs for CloudWatch / Datadog
- [ ] **Set `CORS_ORIGINS`** to your production domain only — do not use `*`
- [ ] **Rotate `JWT_SECRET_KEY`** — generate a fresh 256-bit hex value: `openssl rand -hex 32`
- [ ] **Set `echo=False`** on the SQLAlchemy engine (it is `False` by default — do not set `echo=True`)
- [ ] **nginx:** Add `proxy_set_header X-Real-IP $remote_addr` — required for rate limiting to use the real client IP instead of the proxy address
- [ ] **Health check:** Verify `GET /health` returns HTTP 200 with `"db_connected": true` and `"pgvector_extension": true` before routing traffic. Load balancers receive HTTP 503 when the DB is degraded.
- [ ] **`is_active` flag:** Set `user.is_active = False` in the DB to ban a user immediately — no token invalidation needed

---

## Cloud Deployment

> Docker + AWS/Render deployment guide coming soon.

The backend is a standard ASGI app compatible with any platform that supports Docker or Python deployments (Railway, Render, Fly.io, AWS ECS). The only external dependency is PostgreSQL 16 with the `pgvector` extension — `pgvector/pgvector:pg16` Docker image or a managed provider like Supabase works.
