from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# Make sure `backend/` is on sys.path so `from app.xxx import ...` works
# whether alembic is run from `backend/` or from the project root.
# ---------------------------------------------------------------------------
backend_dir = Path(__file__).resolve().parent.parent  # backend/
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Load .env so DATABASE_URL is available when running alembic from the CLI
load_dotenv(backend_dir / ".env")

# Alembic Config object — gives access to alembic.ini values
config = context.config

# Set up Python logging from alembic.ini [loggers] section
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import Base + all models so Alembic can detect schema changes
from app.database import Base  # noqa: E402
import app.models  # noqa: E402, F401 — registers Proposal with Base

target_metadata = Base.metadata


def _get_sync_url() -> str:
    """
    Convert the async DATABASE_URL (postgresql+asyncpg://...)
    to a sync URL (postgresql+psycopg2://...) for Alembic's CLI.
    asyncpg cannot be used by Alembic's synchronous migration runner.
    """
    url = os.environ["DATABASE_URL"]
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


def run_migrations_offline() -> None:
    """
    Offline mode: generate SQL without a live DB connection.
    Useful for previewing migrations or generating SQL for DBAs.
    """
    context.configure(
        url=_get_sync_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Online mode: connect to the DB and apply migrations directly.
    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _get_sync_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # no pooling during migrations
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # detect column type changes
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
