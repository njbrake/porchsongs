# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Python deps
uv sync

# Frontend
cd frontend && npm install && npm run build

# Run server (serves API + built frontend)
cd backend && uv run uvicorn app.main:app --reload

# Frontend dev with hot reload (proxies /api to localhost:8000)
cd frontend && npm run dev

# Tests (from project root)
uv run pytest           # all 96 tests
uv run pytest -v        # verbose
uv run pytest tests/test_api.py::test_create_profile  # single test

# Lint & type check
uv run ruff check backend/
uv run ruff format backend/
uv run ty check

# Docker
docker compose up --build
```

## Architecture

**FastAPI backend** (`backend/app/`) serves a **React 19 frontend** (`frontend/src/`) built with Vite. In production, FastAPI serves the built `frontend/dist/` as static files. In development, Vite proxies `/api` requests to the backend.

### LLM Integration

All LLM calls go through `any-llm-sdk` which supports 38+ providers. API keys are read from server-side environment variables (e.g. `OPENAI_API_KEY`) — the SDK resolves them automatically. The frontend never handles or stores API keys. `GET /api/providers` returns only providers whose env var is set. Optional auth via `APP_SECRET` env var gates all `/api/` routes behind a bearer token. All LLM-calling functions are `async` and must use `acompletion`/`alist_models` (not the sync versions), because FastAPI async endpoints run on the event loop.

Three LLM interaction modes:
- **Full rewrite** (`POST /api/rewrite`) — rewrites entire song at once; supports `?stream=true` for SSE streaming
- **Line workshop** (`POST /api/workshop-line`) — generates 3 alternatives for a single line
- **Chat** (`POST /api/chat`) — multi-turn conversation for iterative edits, persists each edit as a `SongRevision`

### Chord Processing

`chord_parser.py` handles the core music logic. Chords sit on lines above their corresponding lyric lines ("above-line" format). When the LLM rewrites lyrics, chords are stripped before sending to the LLM, then proportionally remapped onto the rewritten text using `realign_chords()`. This snaps chord positions to word boundaries and avoids overlaps.

### Profile & Prompt Building

Profiles have a freeform `description` field (not structured fields). The description is inserted into the LLM prompt as-is. `build_user_prompt()` in `llm_service.py` assembles the full prompt from: profile description, learned substitution patterns, a recent completed example, optional user instructions, and the lyrics.

### Song Lifecycle

Paste lyrics → rewrite → auto-saved as "draft" → iterate via chat/workshop → mark "completed" → patterns extracted by LLM and saved to `substitution_patterns` table → future rewrites for that profile include learned patterns. Songs can be organized into folders.

### Tab Fetching & PDF Export

`tab_fetcher.py` fetches tabs from Ultimate Guitar using `curl_cffi` (to bypass Cloudflare). `pdf_service.py` generates monospace PDFs with chord alignment using `fpdf2`. Both are exposed via API endpoints.

### Profile Models

Each profile can have per-provider LLM configuration (custom `api_base`) stored in the `ProfileModel` table, managed via dedicated CRUD endpoints.

## Testing

Tests use in-memory SQLite with `StaticPool` + `check_same_thread=False` (required because FastAPI TestClient runs in a separate thread). The `client` fixture overrides `get_db` to use the test DB.

LLM-dependent endpoints are tested by mocking `acompletion` and `alist_models` with `AsyncMock` — patch target is `app.services.llm_service.acompletion`. The mock returns a `MagicMock` shaped like a `ChatCompletion` response (`.choices[0].message.content`).

## Key Constraints

- **Ruff rules**: `E, F, I, UP, B, SIM, ANN, RUF` with `B008` ignored (FastAPI `Depends()` pattern). All backend code requires type annotations.
- **Config**: `Settings` in `config.py` uses `extra="ignore"` so arbitrary env vars (like `OPENAI_API_KEY`) don't crash startup.
- **Migrations**: `main.py` auto-adds missing columns on startup via `ALTER TABLE` — no migration framework, just column existence checks with SQLAlchemy `inspect`.
- **Schemas**: `source_url`, `title`, and `artist` are all optional on `RewriteRequest` and `SongCreate`. The frontend sends only `lyrics` + `instruction` + LLM settings.
