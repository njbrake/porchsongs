"""add song updated_at

Revision ID: 008
Revises: 007
Create Date: 2026-02-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "songs",
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    # Backfill existing rows: set updated_at = created_at
    songs = sa.table("songs", sa.column("updated_at"), sa.column("created_at"))
    op.execute(songs.update().values(updated_at=songs.c.created_at))
    # Now make it non-nullable
    with op.batch_alter_table("songs") as batch_op:
        batch_op.alter_column("updated_at", nullable=False)


def downgrade() -> None:
    op.drop_column("songs", "updated_at")
