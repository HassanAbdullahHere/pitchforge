from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    profile_chunks: Mapped[list["ProfileChunk"]] = relationship(
        "ProfileChunk", back_populates="user", cascade="all, delete-orphan"
    )
    profile: Mapped["UserProfile | None"] = relationship(
        "UserProfile", back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class ProfileChunk(Base):
    """
    Stores per-user embedded profile chunks for pgvector similarity search.
    chunk_key is the semantic label ("skills", "project_0", etc.).
    Unique per (user_id, chunk_key) — one chunk type per user.
    """

    __tablename__ = "profile_chunks"
    __table_args__ = (
        UniqueConstraint("user_id", "chunk_key", name="uq_profile_chunks_user_chunk"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_key: Mapped[str] = mapped_column(String(64), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list] = mapped_column(Vector(3072), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="profile_chunks")


class UserProfile(Base):
    """
    Raw structured profile for one user — source of truth for display and editing.
    profile_chunks stores the RAG-optimized version derived from this.
    One row per user (enforced by UNIQUE on user_id).
    """

    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    projects: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    experience: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    niches: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    rates: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
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

    user: Mapped["User"] = relationship("User", back_populates="profile")


class UsageEvent(Base):
    """
    One row per pipeline phase per run. Tracks token consumption and cost for
    admin reporting. proposal_id is SET NULL on proposal delete so cost history
    is preserved even after a proposal is removed.
    """

    __tablename__ = "usage_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("proposals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    phase: Mapped[str] = mapped_column(String(20), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
