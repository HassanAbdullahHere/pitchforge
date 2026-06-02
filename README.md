<div align="center">

<img src="docs/banner.svg" alt="PitchForge" width="100%"/>

<br/><br/>

![Status](https://img.shields.io/badge/Status-In_Development-yellow?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)

![LangGraph](https://img.shields.io/badge/LangGraph-Pipeline-FF6B35?style=flat-square)
![pgvector](https://img.shields.io/badge/pgvector-Hybrid_RAG-336791?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google-OAuth_2.0-EA4335?style=flat-square&logo=google&logoColor=white)
![uv](https://img.shields.io/badge/uv-Package_Manager-DE5FE9?style=flat-square)
![JWT](https://img.shields.io/badge/JWT-HS256-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)

</div>

---

## What is PitchForge

Most freelance proposals get ignored. Not because the freelancer is underqualified — because the proposal reads like everyone else's.

PitchForge takes a job posting, scores your fit against your actual profile using hybrid RAG retrieval, and runs an automated generate → critique loop until the proposal clears an 85/100 quality threshold. Then it hands the result to you for final approval.

Every skill claim traces back to your retrieved profile. Every AI-slop phrase gets penalized by name.

---

## Architecture

```mermaid
graph LR
    A["⚛️ React + Vite\nFrontend"] -->|"SSE token stream"| B["⚡ FastAPI\nBackend"]
    B -->|"astream_events v2"| C["🔗 LangGraph\n8-node Pipeline"]
    C <-->|"Checkpoint\nstate persistence"| D[("🐘 PostgreSQL 16\n+ pgvector")]
    B <-->|"SQLAlchemy async\n+ asyncpg"| D
    C -->|"Hybrid RAG\nretrieval"| D
```

Three independent layers. The frontend never sees raw graph state. The backend never calls the graph directly — only `runner.py` does. The database is the single source of truth for application state, vector embeddings, and graph checkpoints.

---

## Getting Started

**Prerequisites:** Docker, [uv](https://docs.astral.sh/uv/), Node.js 18+

```bash
# 1 — Start PostgreSQL
docker-compose up -d

# 2 — Apply DB migrations
cd backend && uv run alembic upgrade head

# 3 — Start backend
cd backend && uv run uvicorn app.main:app --reload

# 4 — Start frontend
cd frontend && npm run dev
```

Copy `.env.example` to `.env` and fill in your values. See [Deployment](docs/deployment.md) for the full environment variable reference.

> **First run:** Sign in via Google, then go to `/profile/edit` to set up your profile. The pipeline will redirect you there automatically if no profile exists.

> **Optional — legacy dev seed:** To seed profile chunks from a JSON file instead of the UI, run `cd pitchforge && uv run python setup_rag.py <your_user_uuid>`. Get your UUID from `GET /api/auth/me` after signing in.

---

## Token Economics

Gemini 2.5 Flash · thinking disabled on all nodes.

| Scenario | Estimated cost |
|----------|:--------------:|
| Typical run (2 auto-iterations) | ~$0.0013 |
| Worst case (3 auto + 2 human revisions) | ~$0.0027 |

**Pricing:** $0.075 / 1M input tokens · $0.30 / 1M output tokens

Key savings: `thinking_budget=0` (47× cheaper than thinking mode), per-node output caps, Critic node does not receive profile chunks (~1,800 tokens saved per critique call).

---

## Go Deeper

| Topic | Doc |
|-------|-----|
| LangGraph pipeline, state schema, RAG, node reference | [Architecture](docs/architecture.md) |
| API endpoints, SSE event stream, middleware | [API](docs/api.md) |
| Security layers, rate limiting, input validation | [Security](docs/security.md) |
| Frontend routes, UX, component overview | [Frontend](docs/frontend.md) |
| Environment variables, production checklist | [Deployment](docs/deployment.md) |

---

<div align="center">
  <sub>Built with care. No shortcuts.</sub>
</div>
