from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
if os.getenv("APP_ENV") != "production":
    load_dotenv()

from fastapi import FastAPI, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from sqlalchemy import text
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

from app.database import AsyncSessionLocal, engine, DATABASE_URL
from app.routers.proposals import router as proposals_router
from app.routers.auth import router as auth_router
from app.routers.profile import router as profile_router
from app.routers.admin import router as admin_router
from app.limiter import limiter
from app.schemas import HealthResponse
from pitchforge.graph import compile_graph
from pitchforge.logging_config import configure_logging
import app.runner as runner_module


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def patched_send(message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append("X-Frame-Options", "DENY")
                headers.append("X-Content-Type-Options", "nosniff")
                headers.append("Content-Security-Policy", "default-src 'none'")
            await send(message)

        await self.app(scope, receive, patched_send)


def _pg_conn_str(url: str) -> str:
    """Convert SQLAlchemy asyncpg URL to a plain psycopg3 connection string."""
    return url.replace("postgresql+asyncpg://", "postgresql://")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    App lifespan: runs once on startup and once on shutdown.
    Creates the PostgreSQL checkpointer (and its tables if missing), compiles
    the LangGraph, then disposes connections on shutdown.
    """
    configure_logging()
    conn_str = _pg_conn_str(DATABASE_URL)
    async with AsyncPostgresSaver.from_conn_string(conn_str) as checkpointer:
        await checkpointer.setup()
        runner_module.pitchforge_graph = compile_graph(checkpointer)
        yield

    await engine.dispose()


async def _rate_limit_handler(request: FastAPIRequest, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again later."})


app = FastAPI(title="PitchForge API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# CORS origins — comma-separated env var for production, localhost defaults for dev
_cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(proposals_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    db_ok = False
    pgvector_ok = False
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
            result = await session.execute(
                text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            )
            pgvector_ok = result.fetchone() is not None
    except Exception:
        pass

    healthy = db_ok and pgvector_ok
    response_data = HealthResponse(
        status="ok" if healthy else "degraded",
        db_connected=db_ok,
        pgvector_extension=pgvector_ok,
    )
    if not healthy:
        return JSONResponse(status_code=503, content=response_data.model_dump())
    return response_data
