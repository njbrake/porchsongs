"""add user terms_accepted_at

Revision ID: 009
Revises: 008
Create Date: 2026-02-27

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("terms_accepted_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "terms_accepted_at")
