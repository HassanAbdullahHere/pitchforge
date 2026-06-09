# ── Stage 1: builder ──────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

RUN pip install uv

COPY pitchforge/pyproject.toml ./pitchforge/
COPY backend/pyproject.toml backend/uv.lock ./backend/

WORKDIR /app/backend
RUN uv sync --frozen --no-dev

# ── Stage 2: runtime ──────────────────────────────────────
FROM python:3.12-slim AS runtime
WORKDIR /app

COPY --from=builder /app/backend/.venv ./backend/.venv
COPY pitchforge/ ./pitchforge/
COPY backend/ ./backend/

ENV PATH="/app/backend/.venv/bin:$PATH"
ENV PYTHONPATH="/app"
ENV APP_ENV=production

EXPOSE 8000

WORKDIR /app/backend
ENTRYPOINT ["sh", "start.sh"]
