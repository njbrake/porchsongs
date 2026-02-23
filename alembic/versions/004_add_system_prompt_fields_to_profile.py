"""add system prompt fields to profile

Revision ID: 004
Revises: 003
Create Date: 2026-02-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("system_prompt_parse", sa.Text(), nullable=True))
    op.add_column("profiles", sa.Column("system_prompt_chat", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "system_prompt_chat")
    op.drop_column("profiles", "system_prompt_parse")
