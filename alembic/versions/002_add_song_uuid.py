"""add uuid column to songs

Revision ID: 002
Revises: 001
Create Date: 2026-02-27

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add uuid column as nullable first (so existing rows don't fail)
    op.add_column("songs", sa.Column("uuid", sa.String(), nullable=True))

    # 2. Backfill existing songs with UUIDs
    conn = op.get_bind()
    songs = conn.execute(sa.text("SELECT id FROM songs WHERE uuid IS NULL"))
    for row in songs:
        conn.execute(
            sa.text("UPDATE songs SET uuid = :uuid WHERE id = :id"),
            {"uuid": str(uuid.uuid4()), "id": row[0]},
        )

    # 3. Make the column non-nullable
    with op.batch_alter_table("songs") as batch_op:
        batch_op.alter_column("uuid", nullable=False)
        batch_op.create_index("ix_songs_uuid", ["uuid"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("songs") as batch_op:
        batch_op.drop_index("ix_songs_uuid")
        batch_op.drop_column("uuid")
