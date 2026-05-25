from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import AsyncSessionLocal, engine
from app.routers.proposals import router as proposals_router
from app.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    App lifespan: runs once on startup and once on shutdown.
    On shutdown, disposes the connection pool so all DB connections
    are cleanly closed before the process exits.
    """
    yield  # engine connects lazily on first use — nothing to do at startup
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

app.include_router(proposals_router, prefix="/api")


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
