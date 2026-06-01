from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Proposal(Base):
    """
    Persistent record of a completed PitchForge run.

    A row is created at analysis time (fit data) and updated at finalization
    (proposal data). This is the foundation for history and analytics, and
    will later be joined to a pgvector embeddings table when ChromaDB is
    migrated.
    """

    __tablename__ = "proposals"

    # UUID PK — avoids auto-increment races, matches LangGraph thread_id style
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # LangGraph thread_id — unique so we can upsert at finalize time
    thread_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )

    # FK to the user who created this proposal
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Job posting fields (denormalised for fast display) ---
    job_title: Mapped[str] = mapped_column(String(150), nullable=False)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    budget: Mapped[str | None] = mapped_column(String(30), nullable=True)
    timeline: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # --- Fit analysis output (nullable — populated at analysis stage) ---
    fit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suggested_price: Mapped[str | None] = mapped_column(String(50), nullable=True)
    matched_skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    missing_skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # --- Proposal output (nullable — populated at finalization stage) ---
    final_proposal: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    iteration_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    revision_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class User(Base):
    """
    Registered user — created on first Google sign-in, updated on subsequent logins.
    google_id is the stable identifier from Google (never changes even if email changes).
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    google_id: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ProfileChunk(Base):
    """
    Stores embedded profile chunks for pgvector similarity search.
    Replaces the ChromaDB PersistentClient used by the retriever node.
    8 rows total (skills, projects, experiences, niches, rates).
    Sequential scan is faster than IVFFlat at this scale.
    """

    __tablename__ = "profile_chunks"

    # String ID — chunk IDs are "skills", "project_0", etc., not UUIDs
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # 3072-dim Gemini embeddings (gemini-embedding-2-preview)
    embedding: Mapped[list] = mapped_column(Vector(3072), nullable=False)
