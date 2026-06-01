"""add_revision_count_to_proposals

Revision ID: 6a1b277087aa
Revises: f2edb5b20f45
Create Date: 2026-06-01 12:45:46.709029

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6a1b277087aa'
down_revision: Union[str, None] = 'f2edb5b20f45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'proposals',
        sa.Column('revision_count', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('proposals', 'revision_count')
