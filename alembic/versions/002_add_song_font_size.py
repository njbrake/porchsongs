"""add song font_size

Revision ID: 002
Revises: 001
Create Date: 2026-02-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("font_size", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("songs", "font_size")
