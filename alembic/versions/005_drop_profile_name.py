"""drop profile name column

Revision ID: 005
Revises: 004
Create Date: 2026-02-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("profiles", "name")


def downgrade() -> None:
    op.add_column("profiles", sa.Column("name", sa.String(), nullable=True))
