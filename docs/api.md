# API Reference

## Endpoints

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|:----:|:----------:|---------|
| `POST` | `/api/auth/google` | — | 10/hr · IP | Exchange Google token → JWT |
| `GET` | `/api/auth/me` | JWT | — | Current user info |
| `GET` | `/health` | — | — | Real DB + pgvector liveness check (503 when degraded) |
| `POST` | `/api/proposal/analyze` | JWT | 14/day · IP · 7/day · user | Start pipeline, stream fit analysis |
| `POST` | `/api/proposal/generate` | JWT | — | Resume from fit checkpoint |
| `POST` | `/api/proposal/revise` | JWT | — | Resume with human feedback (max 2 revisions) |
| `POST` | `/api/proposal/finalize` | JWT | — | Approve → compile → persist to DB |
| `GET` | `/api/proposals` | JWT | — | All finalized proposals (current user) |
| `GET` | `/api/proposals/{id}` | JWT | — | Single proposal with full detail |
| `DELETE` | `/api/proposals/{id}` | JWT | — | Hard delete · 204 on success |
| `GET` | `/api/usage` | JWT | — | Today's analysis count vs. 7/day limit |
| `GET` | `/api/profile` | JWT | — | Retrieve saved profile |
| `POST` | `/api/profile` | JWT | 8/day · IP · 4/day · user | Save profile + re-embed all chunks |
| `POST` | `/api/profile/parse-resume` | JWT | 4/day · IP · 2/day · user | PDF / DOCX → structured profile JSON |

---

## SSE Event Stream

All pipeline endpoints return `text/event-stream`. Every frame is a JSON-encoded event.

| Event | When | Key payload fields |
|-------|------|--------------------|
| `status` | Stream opens — before any node runs | `message` |
| `node_start` | Node begins executing | `node`, `label` |
| `token` | Generator streaming word-by-word | `token` |
| `node_complete` | Node finishes | `node` |
| `interrupt` | Graph paused for human input | `type`, `thread_id`, fit data |
| `done` | Stream complete | result payload |
| `error` | Failure — sanitized message only | `message` |

The `status` event is emitted before the prompt injection guard runs so the stream is open before any LLM call starts. Error messages are sanitized — full exceptions are logged server-side only via `logger.exception()`.

---

## Middleware Stack

```
Request → CORS → Security Headers → Rate Limiter → Router → Handler
```

| Layer | Effect |
|-------|--------|
| **CORSMiddleware** | Configurable origins via `CORS_ORIGINS` env var |
| **SecurityHeadersMiddleware** | `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Content-Security-Policy: default-src 'none'` |
| **slowapi RateLimiter** | Per-IP + per-user limits on sensitive endpoints |

---

## Proposal Lifecycle

The `Proposal` row is written in two phases:

1. **Created at `/analyze`** — fit data written: `fit_score`, `suggested_price`, `matched_skills`, `missing_skills`, `recommendation`
2. **Updated at `/finalize`** — final content written: `final_proposal`, `quality_score`, `iteration_count`

The `thread_id` column links the row to the LangGraph checkpoint store. Graph state survives backend restarts — a user can close the browser and resume from where they left off as long as the `thread_id` is preserved.

---

## Observability

Structured logging via `structlog` — configured once at FastAPI startup.

| Mode | Output | How to activate |
|------|--------|----------------|
| Development | Pretty colored console | `LOG_FORMAT=pretty` (default) |
| Production | JSON lines — CloudWatch / Datadog / any aggregator | `LOG_FORMAT=json` |

`thread_id` and `user_id` are bound as structlog context variables at the start of every streaming request. Every log line from every pipeline node automatically carries both fields.

| Level | What's logged |
|-------|--------------|
| `info` | Node start / complete, pipeline milestones |
| `debug` | Token usage per LLM call (input + output tokens) |
| `warning` | JSON parse failures, unexpected node output shapes |
