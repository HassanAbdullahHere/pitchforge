from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

# Shared async engine for the whole process lifetime.
# pool_pre_ping=True sends SELECT 1 before handing out a connection —
# handles stale connections after container restarts without crashing.
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,  # set True to log all SQL
)

# Session factory — one AsyncSession per request.
# expire_on_commit=False prevents lazy-load after commit (which would need
# another IO call and fail in async context).
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Declarative base — all ORM models inherit from this."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency: yields one DB session per request.
    Commits on success, rolls back on exception.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
