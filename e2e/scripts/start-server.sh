#!/usr/bin/env bash
# Start the backend server for E2E tests.
# Usage: ./start-server.sh <port> <database_url> [extra-env-vars...]
#
# The script:
# 1. Builds the frontend if dist/ doesn't exist
# 2. Creates database tables using Base.metadata (drop + create for clean state)
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

# Export env vars passed as extra arguments (e.g. APP_SECRET=xxx)
for arg in "$@"; do
  export "$arg"
done

export DATABASE_URL

# Create fresh tables (drop existing to ensure clean state)
cd backend
uv run python -c "
from app.database import engine, Base
from app import models  # noqa: F401
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print('[e2e] Database tables created')
"

# Start uvicorn
echo "[e2e] Starting server on port $PORT..."
exec uv run uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
