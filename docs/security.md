# Security

Defense in layers. No single point of trust.

## Security Layers

| Layer | What it protects | Implementation |
|-------|-----------------|---------------|
| **Prompt Injection Guard** | Job posting + feedback cannot hijack the LLM pipeline | Gemini Flash binary classifier (`max_tokens=10`); 8 attack pattern categories; runs before any graph call; emits `status` SSE event first so the stream is already open |
| **JWT Auth** | All proposal + profile endpoints | HS256 · 7-day expiry · `verify_token()` on every request; `is_active=False` bans immediately |
| **Google OAuth** | Identity verification | `google_id` as stable PK — unaffected if email changes; Google userinfo endpoint validation |
| **Thread Ownership** | Users cannot access or modify each other's proposals | `Proposal.user_id == current_user.id` on every graph resume; 403 on mismatch |
| **Atomic Revision Limit** | Race-condition-proof 2-revision cap | `UPDATE ... WHERE revision_count < 2 RETURNING id`; concurrent requests cannot both pass |
| **Input Validation** | Oversized / malformed inputs rejected at boundary | Pydantic v2: `thread_id` ≤ 64 chars; `description` 50–8,000 chars; `skills` ≤ 60 items each ≤ 100 chars; `projects` ≤ 20 |
| **Sanitized Error Messages** | Internal stack traces never reach clients | Full exception logged via `logger.exception()`; only a generic string emitted in the `error` SSE frame |
| **httpx Auth Timeout** | Hanging Google auth requests | 10s timeout on Google userinfo call; returns 504 on `TimeoutException` |
| **Security Headers** | Clickjacking · MIME sniffing · script injection | Pure ASGI middleware; applied to every HTTP response |
| **LLM 503 Retry** | Upstream Gemini service flakiness | 3 attempts · exponential backoff + jitter on all 5 LLM instances |

---

## Rate Limiting

Two dimensions: IP-based at the edge, per-user for authenticated actions.

| Endpoint | IP Limit | User Limit | Notes |
|----------|:--------:|:---------:|-------|
| `/api/proposal/analyze` | 14 / day | 7 / day | User limit counted in DB — survives restarts |
| `/api/auth/google` | 10 / hour | — | Pre-auth; IP only |
| `POST /api/profile` | 8 / day | 4 / day | Re-embedding all chunks is LLM-expensive |
| `POST /api/profile/parse-resume` | 4 / day | 2 / day | One Gemini extraction call per upload |

**IP extraction** is CDN/proxy-aware: `CF-Connecting-IP` → `X-Real-IP` (nginx) → `X-Forwarded-For` (first hop) → `request.client.host`.

**User key** is extracted from the JWT Bearer token — falls back to IP if the token is absent or invalid.

> **nginx requirement:** Set `proxy_set_header X-Real-IP $remote_addr` so the backend receives the real client IP rather than the proxy address.
