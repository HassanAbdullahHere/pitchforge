"""create_usage_events_table

Revision ID: 4f2026886409
Revises: 4c607c52f169
Create Date: 2026-06-05 11:15:38.177680

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4f2026886409'
down_revision: Union[str, None] = '4c607c52f169'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('usage_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('proposal_id', sa.UUID(), nullable=True),
    sa.Column('phase', sa.String(length=20), nullable=False),
    sa.Column('input_tokens', sa.Integer(), nullable=False),
    sa.Column('output_tokens', sa.Integer(), nullable=False),
    sa.Column('cost_usd', sa.Float(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['proposal_id'], ['proposals.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usage_events_proposal_id'), 'usage_events', ['proposal_id'], unique=False)
    op.create_index(op.f('ix_usage_events_user_id'), 'usage_events', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_usage_events_user_id'), table_name='usage_events')
    op.drop_index(op.f('ix_usage_events_proposal_id'), table_name='usage_events')
    op.drop_table('usage_events')
