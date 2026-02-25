# Sandbox Tips

## Pre-commit hooks

`pre-commit install` won't work in the sandbox because the worktree git setup isn't a standard repo. Run hook commands directly instead:

```bash
# Ruff lint + format
uv run ruff check backend/
uv run ruff format --check backend/

# OpenAPI types freshness (regenerate and verify)
uv run python scripts/export_openapi.py frontend/openapi.json
cd frontend && npm run generate:api
# In sandbox, git diff won't work — just run typecheck to verify consistency:
cd frontend && npm run typecheck

# Frontend checks
cd frontend && npm run typecheck
cd frontend && npx eslint src/
cd frontend && npx vitest run

# Backend tests
DATABASE_URL="sqlite:///:memory:" uv run pytest -x -q
```

## Git operations

- `git diff`, `git status`, `git log` won't work due to the worktree setup
- `git push` is blocked (read-only access)
- Don't attempt `pre-commit install`, `git commit`, or other git write operations

## Ephemeral directories

`target/`, `node_modules/`, and `.venv/` don't persist between sessions. Run `uv sync` and `npm install` at the start of each session if needed.
