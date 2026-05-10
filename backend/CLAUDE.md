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
All functions are **async generators** that yield SSE frames (`str`). The graph is invoked via `astream_events(version="v2")` — no sync `invoke()` calls.

| Function | Trigger | SSE events emitted |
|----------|---------|---------|
| `stream_analysis(job_input)` | New thread, streams to fit_checkpoint interrupt | `node_start`, `node_complete`, `interrupt` (fit_checkpoint), `done` |
| `stream_generation(thread_id, should_apply)` | Resumes fit_checkpoint, streams to human_checkpoint | `node_start`, `node_complete`, `token`, `done` |
| `stream_revise(thread_id, instruction)` | Resumes human_checkpoint with feedback, one revision pass | `node_start`, `node_complete`, `token`, `done` |
| `stream_finalize(thread_id)` | Resumes human_checkpoint with "y", streams to END | `node_start`, `node_complete`, `done` |

### SSE Frame Format
```
event: <event_name>\ndata: <json_payload>\n\n
```
Helper: `_sse(event, data) -> str`

### Key Helpers
- `GRAPH_NODES` — set of node names to watch for `on_chain_start`/`on_chain_end`
- `NODE_LABELS` — human-readable labels per node
- `create_thread_id()` — generates a UUID-based thread ID
- `_config(thread_id)` — builds LangGraph `{"configurable": {"thread_id": ...}}`
- Interrupt detection: `astream_events` ends naturally when graph hits `interrupt()` → read state with `await aget_state(config)`

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

## Rules
1. `runner.py` is the only file that invokes the LangGraph graph — no graph calls in routers or main
2. Routers call runner functions and handle HTTP concerns only
3. All request/response shapes live in `schemas.py`
4. Run with: `uv run uvicorn app.main:app --reload` from `backend/` (must use `uv run`, not bare `uvicorn`)
