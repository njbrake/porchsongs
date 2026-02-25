"""rename lyrics columns to content

Revision ID: 003
Revises: 002
Create Date: 2026-02-21

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("songs", "original_lyrics", new_column_name="original_content")
    op.alter_column("songs", "rewritten_lyrics", new_column_name="rewritten_content")
    op.alter_column("song_revisions", "rewritten_lyrics", new_column_name="rewritten_content")


def downgrade() -> None:
    op.alter_column("songs", "original_content", new_column_name="original_lyrics")
    op.alter_column("songs", "rewritten_content", new_column_name="rewritten_lyrics")
    op.alter_column("song_revisions", "rewritten_content", new_column_name="rewritten_lyrics")
