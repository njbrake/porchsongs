"""drop vestigial password_hash and description columns

Revision ID: 006
Revises: 005
Create Date: 2026-02-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("users", "password_hash")
    op.drop_column("profiles", "description")


def downgrade() -> None:
    op.add_column("profiles", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(), nullable=True))
