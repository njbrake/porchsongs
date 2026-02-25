#!/usr/bin/env bash
# Start the backend server for E2E tests.
# Usage: ./start-server.sh <port> <database_url> [extra-env-vars...]
#
# The script:
# 1. Builds the frontend if dist/ doesn't exist
# 2. Creates the SQLite database using Base.metadata.create_all (avoids Alembic/Postgres migrations)
# 3. Starts uvicorn on the given port

set -euo pipefail

PORT="${1:?Usage: start-server.sh <port> <database_url>}"
DATABASE_URL="${2:?Usage: start-server.sh <port> <database_url>}"
shift 2

# Project root is two levels up from this script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Build frontend if dist/ doesn't exist
if [ ! -d "frontend/dist" ]; then
  echo "[e2e] Building frontend..."
  (cd frontend && npm install && npm run build)
fi

# Delete old SQLite file if it exists, then create fresh tables
DB_PATH="${DATABASE_URL#sqlite:///}"
if [ -f "$DB_PATH" ]; then
  rm -f "$DB_PATH"
fi

# Export env vars passed as extra arguments (e.g. APP_SECRET=xxx)
for arg in "$@"; do
  export "$arg"
done

export DATABASE_URL

# Create tables using SQLAlchemy metadata (no Alembic needed)
cd backend
uv run python -c "
from app.database import engine, Base
from app import models  # noqa: F401
Base.metadata.create_all(bind=engine)
print('[e2e] Database tables created')
"

# Start uvicorn
echo "[e2e] Starting server on port $PORT..."
exec uv run uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
