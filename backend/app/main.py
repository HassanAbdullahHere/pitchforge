from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from sqlalchemy import text
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

from app.database import AsyncSessionLocal, engine, DATABASE_URL
from app.routers.proposals import router as proposals_router
from app.routers.auth import router as auth_router
from app.schemas import HealthResponse
from pitchforge.graph import compile_graph
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
    conn_str = _pg_conn_str(DATABASE_URL)
    async with AsyncPostgresSaver.from_conn_string(conn_str) as checkpointer:
        await checkpointer.setup()
        runner_module.pitchforge_graph = compile_graph(checkpointer)
        yield

    await engine.dispose()


app = FastAPI(title="PitchForge API", lifespan=lifespan)

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


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """
    Health check. Verifies the PostgreSQL connection is alive via SELECT 1.
    chromadb_connected and gemini_reachable are wired in Step 2 (pgvector migration).
    """
    db_ok = False
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return HealthResponse(
        status="ok" if db_ok else "degraded",
        db_connected=db_ok,
        chromadb_connected=False,
        gemini_reachable=False,
    )
