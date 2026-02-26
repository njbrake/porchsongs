# Sandbox Tips

## Pre-commit hooks

`pre-commit` is not installed in the sandbox. Run hook commands directly instead:

```bash
# Ruff lint + format
uv run ruff check backend/
uv run ruff format --check backend/

# OpenAPI types freshness (regenerate and verify)
uv run python scripts/export_openapi.py frontend/openapi.json
cd frontend && npm run generate:api
cd frontend && npm run typecheck

# Frontend checks
cd frontend && npm run typecheck
cd frontend && npx eslint src/
cd frontend && npx vitest run

# Backend tests
DATABASE_URL="sqlite:///:memory:" uv run pytest -x -q
```

## Git operations

Git works normally — `git diff`, `git status`, `git log`, `git commit` all work. Push access is configured via `gh` auth.

## Ephemeral directories

`target/`, `node_modules/`, and `.venv/` don't persist between sessions. Run `uv sync` and `npm install` at the start of each session if needed.
