# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For tips about running in a sandbox environment (pre-commit hooks, ephemeral dirs), see [tips/sandbox.md](tips/sandbox.md).

For tips about using the Playwright MCP plugin in the sandbox (browser install, --no-sandbox, direct scripts for layout debugging), see [tips/playwright.md](tips/playwright.md).

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

# Tests
DATABASE_URL="sqlite:///:memory:" uv run pytest              # backend
cd frontend && npx vitest run                                # frontend unit
cd e2e && npx playwright test                                # e2e (starts servers automatically)

# Lint & type check
uv run ruff check backend/
uv run ruff format backend/
cd frontend && npx eslint src/
cd frontend && npm run typecheck

# Database migrations
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "description"
```

## Architecture

**FastAPI backend** (`backend/app/`) serves a **React 19 + TypeScript frontend** (`frontend/src/`) built with Vite. In production, FastAPI serves the built `frontend/dist/` as static files. In development, Vite proxies `/api` requests to the backend.

### Frontend Routing

React Router (`react-router-dom`) with `BrowserRouter`. App routes live under `/app/*`:

- `/app/rewrite`, `/app/library`, `/app/library/:id`, `/app/settings/:tab`, `/app/login`
- Premium marketing pages at root: `/`, `/pricing`, `/about`, `/how-to`, `/how-to/:slug`
- OSS mode: `/` redirects to `/app`

Key layers:
- **`AuthContext`** (`src/contexts/AuthContext.tsx`) — Auth state, login/logout. Wraps entire app.
- **`AppShell`** (`src/layouts/AppShell.tsx`) — Auth-gated layout for `/app/*`. Holds app state (profile, rewrite, LLM settings) and passes to children via `useOutletContext<AppShellContext>()`.
- **`MarketingLayout`** (`src/layouts/MarketingLayout.tsx`) — Marketing nav/footer (premium only).

SEO meta injection (premium): `premium/porchsongs_premium/seo.py` injects route-specific meta tags into `index.html` server-side.

### Auth

Plugin architecture in `backend/app/auth/`. **OSS is auth-free** — `get_current_user` auto-creates and returns a single local user (`local@porchsongs.local`). No login required. Premium adds Google OAuth via `PREMIUM_PLUGIN` env var, overriding `get_current_user` with JWT validation. JWT tokens, refresh tokens, rate limiting, and login/logout endpoints all live in the premium layer. Every data endpoint uses `Depends(get_current_user)` with `user_id` filtering. The auth ABC (`AuthBackend`), token utilities, and rate limiter remain in OSS for premium to import.

### LLM Integration

All LLM calls go through `any-llm-sdk`. API keys from server env vars. Two modes: **Parse** (clean up + identify title/artist, SSE streaming) and **Chat** (multi-turn iterative edits, SSE streaming). All LLM functions must be `async` using `acompletion`/`alist_models`.

### SSE Streaming

Always add `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers. Never use Starlette's `BaseHTTPMiddleware` for SSE — use pure ASGI middleware instead.

### Data Model

PostgreSQL in production, in-memory SQLite for tests. Alembic migrations in `alembic/`. Song lifecycle: paste → parse → auto-save draft → iterate via chat → completed. Songs organized into folders. PDF export via `fpdf2`.

## Frontend Development

### Playwright MCP Plugin

**All frontend development should use the Claude Playwright MCP plugin** to visually verify changes in a real browser. After making UI changes:

1. Start the dev server (`cd frontend && npm run dev`)
2. Use the Playwright MCP tools to navigate to the relevant page and take screenshots
3. Visually confirm the layout, styling, and interactions match expectations
4. Use this workflow for iterating on CSS, component structure, and responsive design

This is especially important for marketing pages, layout changes, and any visual work where unit tests alone cannot catch regressions. The Playwright plugin provides `browser_navigate`, `browser_screenshot`, `browser_click`, and other tools to interact with the running app.

### E2E Tests

Playwright e2e tests live in `e2e/oss/` and `e2e/premium/`. The `playwright.config.ts` auto-starts backend servers on ports 8765 (OSS) and 8766 (premium). Run with `cd e2e && npx playwright test`.

### Design System

Tailwind CSS v4 with `@theme` tokens in `src/index.css`:
- **Colors**: Use `--color-*` tokens, never hardcode hex values
- **Fonts**: `font-mono` / `font-ui` from `@theme`
- **UI primitives**: Always use components from `src/components/ui/` (`Button`, `Input`, `Card`, etc.) instead of raw HTML
- **Class names**: Use `cn()` from `@/lib/utils` for conditional classes, not template literals
- **Cascade layers**: All custom CSS must be inside `@layer base { ... }` — unlayered CSS silently overrides Tailwind utilities

### Code Conventions

- `@/` path aliases for all imports. Types in `src/types.ts`.
- `STORAGE_KEYS` from `src/api.ts` for all localStorage keys
- `_fetch<T>()` for JSON endpoints, `_streamSse<T>()` for SSE streaming
- `aria-label` on all icon-only buttons
- `dvh` (not `vh`) for viewport height

## Testing

Backend: in-memory SQLite with `StaticPool`. Mock LLM calls via `AsyncMock` on `app.services.llm_service.acompletion`. Auth tests use `auth_client` fixture without `get_current_user` override.

Frontend: Vitest + React Testing Library. Use `renderWithRouter()` from `src/test/test-utils.tsx` for components using React Router.

## Definition of Done

**Bug fixes must include a test** that reproduces the bug and verifies the fix. Feature changes should include tests for new behavior. If an existing test file covers the component/module, add tests there; otherwise create a new `*.test.ts(x)` file following existing patterns.

Every change must pass all checks:

```bash
uv run ruff check backend/                    # backend lint
uv run ruff format --check backend/           # backend formatting
cd frontend && npx eslint src/                # frontend lint
cd frontend && npm run typecheck              # TypeScript type check
DATABASE_URL="sqlite:///:memory:" uv run pytest  # backend tests
cd frontend && npx vitest run                 # frontend tests
```

## Key Constraints

- **TypeScript** strict mode with `noUncheckedIndexedAccess`
- **Ruff rules**: `E, F, I, UP, B, SIM, ANN, RUF` with `B008` ignored. All backend code requires type annotations.
- **Config**: `Settings` uses `extra="ignore"` so arbitrary env vars don't crash startup
- **Auth**: Every data endpoint requires `Depends(get_current_user)`. Use `get_user_profile()` / `get_user_song()` for ownership checks.
