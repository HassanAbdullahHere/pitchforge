"""add_user_id_to_profile_chunks

Revision ID: df40bd9c02f8
Revises: 6a1b277087aa
Create Date: 2026-06-02 13:16:41.035750

Restructures profile_chunks for per-user ownership:
  - Clears existing global dev data (no user_id, unusable after this)
  - Renames string PK column id → chunk_key
  - Adds UUID id as new PK
  - Adds user_id FK → users.id (CASCADE DELETE)
  - Adds unique constraint (user_id, chunk_key)
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'df40bd9c02f8'
down_revision: Union[str, None] = '6a1b277087aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clear global dev data — no user_id, cannot be migrated forward
    op.execute("TRUNCATE TABLE profile_chunks")

    # Rename old string PK column to chunk_key
    op.alter_column('profile_chunks', 'id', new_column_name='chunk_key')

    # Drop old string primary key
    op.drop_constraint('profile_chunks_pkey', 'profile_chunks', type_='primary')

    # Add new UUID id column as PK
    op.add_column('profile_chunks', sa.Column(
        'id',
        postgresql.UUID(as_uuid=True),
        nullable=False,
        server_default=sa.text('gen_random_uuid()'),
    ))
    op.create_primary_key('profile_chunks_pkey', 'profile_chunks', ['id'])

    # Add user_id FK — NOT NULL safe because we truncated above
    op.add_column('profile_chunks', sa.Column(
        'user_id',
        postgresql.UUID(as_uuid=True),
        nullable=False,
    ))
    op.create_foreign_key(
        'fk_profile_chunks_user_id_users',
        'profile_chunks', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_profile_chunks_user_id', 'profile_chunks', ['user_id'])

    # One chunk type per user
    op.create_unique_constraint(
        'uq_profile_chunks_user_chunk',
        'profile_chunks',
        ['user_id', 'chunk_key'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_profile_chunks_user_chunk', 'profile_chunks', type_='unique')
    op.drop_index('ix_profile_chunks_user_id', table_name='profile_chunks')
    op.drop_constraint('fk_profile_chunks_user_id_users', 'profile_chunks', type_='foreignkey')
    op.drop_column('profile_chunks', 'user_id')
    op.drop_constraint('profile_chunks_pkey', 'profile_chunks', type_='primary')
    op.drop_column('profile_chunks', 'id')
    op.create_primary_key('profile_chunks_pkey', 'profile_chunks', ['chunk_key'])
    op.alter_column('profile_chunks', 'chunk_key', new_column_name='id')
