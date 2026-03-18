"""fix redundant unique index on refresh_tokens.token

The initial migration created both a UNIQUE column constraint (in CREATE TABLE)
and a UNIQUE INDEX on refresh_tokens.token. In PostgreSQL these are separate
objects, and alembic check flags the redundancy. Drop the unique index and
recreate as non-unique since the column constraint already enforces uniqueness.

Revision ID: 003
Revises: 002
Create Date: 2026-03-18

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_refresh_tokens_token", table_name="refresh_tokens")
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_token", table_name="refresh_tokens")
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"], unique=True)
