"""enable_pgvector_create_profile_chunks

Revision ID: b1057d5132ef
Revises: d144029e92c9
Create Date: 2026-05-25 20:25:50.177061

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'b1057d5132ef'
down_revision: Union[str, None] = 'd144029e92c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extension must be created BEFORE any table with a vector column
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table(
        'profile_chunks',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(3072), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('profile_chunks')
    # Intentionally NOT dropping the vector extension —
    # other tables may use it, and dropping extensions is destructive
