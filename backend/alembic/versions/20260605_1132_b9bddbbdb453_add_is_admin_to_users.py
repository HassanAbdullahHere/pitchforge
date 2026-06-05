"""add_is_admin_to_users

Revision ID: b9bddbbdb453
Revises: 4f2026886409
Create Date: 2026-06-05 11:32:11.397593

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b9bddbbdb453'
down_revision: Union[str, None] = '4f2026886409'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('users', 'is_admin')
