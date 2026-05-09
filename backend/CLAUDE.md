# backend/ — FastAPI Layer

## Files
```
backend/
├── pyproject.toml       # Depends on pitchforge via uv path source (editable)
└── app/
    ├── __init__.py
    ├── main.py          # FastAPI app creation + router inclusion  ⬜ todo
    ├── runner.py        # All LangGraph invocations — only file that calls the graph
    ├── schemas.py       # Pydantic request/response models
    └── routers/
        ├── __init__.py
        └── proposals.py # /proposals endpoints  ⬜ todo
```

---

## Runner Functions (runner.py)
| Function | Trigger | Returns |
|----------|---------|---------|
| `run_analysis(job_input)` | New thread, graph runs to fit_checkpoint interrupt | fit report (fit_score, suggested_price, matched_skills, missing_skills, job_analysis) |
| `run_generation(thread_id, should_apply)` | Resumes fit_checkpoint with y/n, runs to human_checkpoint | proposal draft + quality_score |
| `run_revise(thread_id, feedback)` | Resumes human_checkpoint with feedback text, one revision pass | updated draft + quality_score |
| `run_finalize(thread_id)` | Resumes human_checkpoint with "y", runs to END | final_proposal |

---

## API Endpoints (proposals.py) — ⬜ todo
| Method | Path | Handler |
|--------|------|---------|
| POST | `/proposals/analyze` | `run_analysis` |
| POST | `/proposals/generate` | `run_generation` |
| POST | `/proposals/revise` | `run_revise` |
| POST | `/proposals/finalize` | `run_finalize` |

---

## Monorepo Import Setup
- `backend/pyproject.toml` declares `pitchforge = { path = "../pitchforge", editable = true }` under `[tool.uv.sources]`
- Import with `from pitchforge.X import ...`

---

## Rules
1. `runner.py` is the only file that invokes the LangGraph graph — no graph calls in routers or main
2. Routers call runner functions and handle HTTP concerns only
3. All request/response shapes live in `schemas.py`
4. Run with: `uvicorn app.main:app --reload` from `backend/`
