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
DATABASE_URL="sqlite:///:memory:" uv run pytest           # all tests (~120)
DATABASE_URL="sqlite:///:memory:" uv run pytest -v         # verbose
DATABASE_URL="sqlite:///:memory:" uv run pytest tests/test_api.py::test_create_profile  # single test

# Frontend tests
cd frontend && npx vitest run                            # all tests (~39)
cd frontend && npx vitest run src/components/Header.test  # single test file

# Lint & type check
uv run ruff check backend/
uv run ruff format backend/
cd frontend && npx eslint src/      # frontend lint
cd frontend && npm run typecheck    # tsc --noEmit

# Database migrations
uv run alembic upgrade head         # apply all migrations
uv run alembic revision --autogenerate -m "description"  # generate new migration

# Docker (includes PostgreSQL)
docker compose up --build
```

## Architecture

**FastAPI backend** (`backend/app/`) serves a **React 19 + TypeScript frontend** (`frontend/src/`) built with Vite. In production, FastAPI serves the built `frontend/dist/` as static files. In development, Vite proxies `/api` requests to the backend.

The frontend uses strict TypeScript with `@/` path aliases (e.g. `import api from '@/api'`). Shared domain interfaces live in `src/types.ts`.

### Auth System

Authentication uses a plugin architecture defined in `backend/app/auth/`:

- **`base.py`** — Abstract `AuthBackend` class with `get_auth_config()`, `authenticate_login()`, `on_user_created()` hooks
- **`app_secret.py`** — OSS single-user backend: gates behind `APP_SECRET` env var, auto-creates a local user
- **`loader.py`** — Plugin loading: uses `PREMIUM_PLUGIN` env var to load external auth backends, falls back to `AppSecretBackend`
- **`tokens.py`** — JWT access tokens (15min) + refresh tokens (30 days), HS256
- **`dependencies.py`** — FastAPI `Depends()` for `get_current_user`. Zero-config dev mode: if `APP_SECRET` not set, auto-returns local user
- **`scoping.py`** — `get_user_profile()` and `get_user_song()` helpers for data isolation

Auth endpoints live in `backend/app/routers/auth.py` (`/api/auth/config`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`).

Every data endpoint uses `Depends(get_current_user)` and filters by `user_id` for data isolation. All router functions are `async def`.

### Database

PostgreSQL in production, in-memory SQLite for tests. Alembic handles migrations (`alembic/` directory). The `User` and `RefreshToken` models support the auth layer. `Profile` and `Song` have `user_id` FK columns for data isolation.

### LLM Integration

All LLM calls go through `any-llm-sdk` which supports 38+ providers. API keys are read from server-side environment variables (e.g. `OPENAI_API_KEY`) — the SDK resolves them automatically. The frontend never handles or stores API keys. `GET /api/providers` returns only providers whose env var is set. All LLM-calling functions are `async` and must use `acompletion`/`alist_models` (not the sync versions), because FastAPI async endpoints run on the event loop.

Three LLM interaction modes:
- **Full rewrite** (`POST /api/rewrite`) — rewrites entire song at once; supports `?stream=true` for SSE streaming
- **Line workshop** (`POST /api/workshop-line`) — generates 3 alternatives for a single line
- **Chat** (`POST /api/chat`) — multi-turn conversation for iterative edits, persists each edit as a `SongRevision`

### SSE Streaming

`POST /api/rewrite?stream=true` uses Server-Sent Events. The auth middleware in `main.py` (`OptionalBearerAuth`) is implemented as **pure ASGI** (`__call__(self, scope, receive, send)`) — not Starlette's `BaseHTTPMiddleware`, which buffers the entire response body and silently breaks `StreamingResponse`/SSE. Always add `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers to SSE responses to prevent reverse proxy buffering.

### Chord Processing

`chord_parser.py` handles the core music logic. Chords sit on lines above their corresponding lyric lines ("above-line" format). When the LLM rewrites lyrics, chords are stripped before sending to the LLM, then proportionally remapped onto the rewritten text using `realign_chords()`. This snaps chord positions to word boundaries and avoids overlaps.

### Profile & Prompt Building

Profiles have a freeform `description` field (not structured fields). The description is inserted into the LLM prompt as-is. `build_user_prompt()` in `llm_service.py` assembles the full prompt from: profile description, learned substitution patterns, a recent completed example, optional user instructions, and the lyrics.

### Song Lifecycle

Paste lyrics → rewrite → auto-saved as "draft" → iterate via chat/workshop → mark "completed" → patterns extracted by LLM and saved to `substitution_patterns` table → future rewrites for that profile include learned patterns. Songs can be organized into folders.

### PDF Export

`pdf_service.py` generates monospace PDFs with chord alignment using `fpdf2`, exposed via an API endpoint.

### Profile Models

Each profile can have per-provider LLM configuration (custom `api_base`) stored in the `ProfileModel` table, managed via dedicated CRUD endpoints.

## Testing

Tests use in-memory SQLite with `StaticPool` + `check_same_thread=False` (required because FastAPI TestClient runs in a separate thread). The `client` fixture overrides both `get_db` and `get_current_user` to inject a test DB and test user. Set `DATABASE_URL=sqlite:///:memory:` when running tests to avoid connecting to PostgreSQL.

LLM-dependent endpoints are tested by mocking `acompletion` and `alist_models` with `AsyncMock` — patch target is `app.services.llm_service.acompletion`. The mock returns a `MagicMock` shaped like a `ChatCompletion` response (`.choices[0].message.content`).

Auth tests in `tests/test_auth.py` use a separate `auth_client` fixture that does NOT override `get_current_user`, allowing the real auth flow to be tested. Use `reset_auth_backend()` between tests that mock settings.

## Definition of Done

Every feature or change must pass all lint and test checks before being considered complete:

```bash
uv run ruff check backend/                    # backend lint
uv run ruff format --check backend/           # backend formatting
cd frontend && npx eslint src/                # frontend lint
cd frontend && npm run typecheck              # TypeScript type check
DATABASE_URL="sqlite:///:memory:" uv run pytest  # backend tests (~120)
cd frontend && npx vitest run                 # frontend tests (~37)
```

## Frontend Design System & Code Style

The frontend uses Tailwind CSS v4 with a custom `@theme` block in `src/index.css`. Follow these conventions to keep the design simple and avoid duplication:

### Tailwind v4 cascade layers

All Tailwind utilities live in `@layer utilities`. Any custom CSS **not** inside a `@layer` block (unlayered) silently overrides all utility classes per CSS spec. Never add unlayered resets like `* { margin: 0 }` — Tailwind preflight handles this. All custom CSS in `index.css` must be inside `@layer base { ... }`.

### Use design tokens, not arbitrary values
- **Colors**: All colors are defined as `--color-*` tokens in `@theme`. Never hardcode hex values — add a new token if needed.
- **Font sizes**: Custom sizes use `--text-*` tokens (e.g. `--text-code: 0.82rem`, `--text-badge: 0.7rem`). Use `text-code`, `text-badge`, etc. instead of `text-[0.82rem]`.
- **Fonts**: `--font-mono` and `--font-ui` are in `@theme`, so use `font-mono` / `font-ui` directly — never `font-[family-name:var(--font-mono)]`.
- **Shadows, radii, animations**: All defined in `@theme`. Use `shadow-sm`, `rounded-md`, `animate-spin`, etc.
- If a value appears more than once and isn't a standard Tailwind utility, make it a `@theme` token.

### Use UI primitives from `src/components/ui/`
- **Always use** `Button`, `Input`, `Select`, `Textarea`, `Card`, `Checkbox`, `Badge`, `Spinner`, `Alert`, `Dialog`, `DropdownMenu`, `Label` instead of raw HTML elements.
- All UI primitives use `forwardRef`, accept `className`, and merge classes via `cn()`.
- Use existing `Button` variants (`default`, `secondary`, `danger`, `danger-outline`, `ghost`, `link`, `link-inline`, `icon`) and sizes (`default`, `sm`, `lg`, `icon`) rather than styling raw `<button>` elements.

### Class names: use `cn()`, not template literals
- Import `cn` from `@/lib/utils` for all conditional or composed class strings.
- Write `cn('base classes', condition && 'conditional-class')` instead of `` `base classes ${condition ? 'x' : ''}` ``.

### Extract repeated patterns
- If a className string or JSX block appears 2+ times, extract it as a constant (e.g. `FOLDER_PILL_CLASS`) or a helper function (e.g. `titleArtistInputs()`).
- Shared class patterns for preformatted text use `PRE_BASE_CLASS` in LibraryTab — follow this pattern for similar repeated styling.

### Storage keys
- All `localStorage` keys are centralized in `STORAGE_KEYS` (exported from `src/api.ts`). Never use raw `'porchsongs_*'` strings — import and reference `STORAGE_KEYS.KEY_NAME`.

### API layer (`src/api.ts`)
- JSON endpoints use `_fetch<T>()` which handles auth refresh, error extraction, and retries automatically.
- SSE streaming endpoints use `_streamSse<T>()` — a generic helper that handles auth, SSE parsing, and token dispatch. Do not duplicate SSE logic.
- Use `_parseApiError()` and `_throwIfNotOk()` for error handling in any new fetch calls.
- Use `_downloadBlob()` for any file download patterns.

### Accessibility
- All icon-only or symbol-only buttons must have `aria-label`.
- Form inputs should have `aria-label` or an associated `<Label>`.

### Responsive design
- Use `dvh` (not `vh`) for viewport height calculations to account for mobile address bars.
- Use `overflow-x: hidden` on containers that might overflow on mobile.
- The `ResizableColumns` component handles desktop split / mobile single-pane automatically via `useIsDesktop()` hook.

## Key Constraints

- **TypeScript**: strict mode with `noUncheckedIndexedAccess`. Use `@/` path aliases for all imports. Domain types are in `src/types.ts`.
- **Ruff rules**: `E, F, I, UP, B, SIM, ANN, RUF` with `B008` ignored (FastAPI `Depends()` pattern). All backend code requires type annotations.
- **Config**: `Settings` in `config.py` uses `extra="ignore"` so arbitrary env vars (like `OPENAI_API_KEY`) don't crash startup.
- **Migrations**: Alembic manages database migrations. Migration files live in `alembic/versions/`. Run `alembic upgrade head` to apply.
- **Schemas**: `source_url`, `title`, and `artist` are all optional on `RewriteRequest` and `SongCreate`. The frontend sends only `lyrics` + `instruction` + LLM settings.
- **Auth**: Every data endpoint requires `Depends(get_current_user)`. Profile and Song models have `user_id` FK. Use `get_user_profile()` / `get_user_song()` from `auth/scoping.py` for ownership checks.
- **Frontend auth**: Access token stored in memory (not localStorage). Refresh token in localStorage. Auto-refresh on 401 with deduplication.
