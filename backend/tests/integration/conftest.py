import os
import uuid
from contextlib import asynccontextmanager
from unittest.mock import MagicMock

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
from app.models import Proposal, User

TEST_DB_URL = os.environ["DATABASE_URL"]

# NullPool: no connection reuse between tests — prevents cross-test state leakage
test_engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
TestSession = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db():
    async with TestSession() as session:
        yield session
        await session.rollback()


@asynccontextmanager
async def _null_lifespan(app):
    import app.runner as runner_module
    runner_module.pitchforge_graph = MagicMock()
    yield


@pytest_asyncio.fixture
async def client(db):
    from app.main import app

    app.router.lifespan_context = _null_lifespan

    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def make_user(db):
    async def _make(*, google_id=None, email="user@test.com", name="Test User",
                    is_active=True, is_admin=False):
        user = User(
            google_id=google_id or str(uuid.uuid4()),
            email=email,
            name=name,
            is_active=is_active,
            is_admin=is_admin,
        )
        db.add(user)
        await db.flush()
        return user
    return _make


@pytest_asyncio.fixture
async def make_proposal(db):
    async def _make(user_id, *, thread_id=None, job_title="Test Job",
                    final_proposal=None, revision_count=0):
        proposal = Proposal(
            thread_id=thread_id or str(uuid.uuid4()),
            user_id=user_id,
            job_title=job_title,
            job_description="A job description long enough.",
            final_proposal=final_proposal,
            revision_count=revision_count,
        )
        db.add(proposal)
        await db.flush()
        return proposal
    return _make
