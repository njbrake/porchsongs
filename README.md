# porchsongs

I'm a suburban dad who loves playing guitar on the porch after the kids go to bed. I listen to Luke Combs and Tyler Childers, but the lyrics are about dirt roads and tailgates — not my cul-de-sac and Subaru. porchsongs fixes that.

Paste a chord chart, chat with an AI to workshop the lyrics into your own life, and play a song that actually sounds like you.

## How It Works

1. **Find a chord chart** — paste an Ultimate Guitar link (or type lyrics manually)
2. **Chat to workshop the lyrics** — tell the AI what to change ("swap the truck for my bike," "make verse 2 about coding") and iterate in a live conversation
3. **Play and enjoy** — chords are automatically realigned above your new lyrics

## Quick Start

```bash
# Install uv (if you don't have it)
pip install uv

# Install dependencies
uv sync

# Run the server
cd backend
uv run uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000).

You'll need an API key from any supported LLM provider — configure it in Settings (gear icon). Click **Verify Connection** to confirm it works, then pick a model.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## LLM Providers

porchsongs uses [any-llm](https://github.com/abhaymathur21/any-llm) for LLM calls, which supports **38+ providers** out of the box — OpenAI, Anthropic, Google, Mistral, Groq, Together, Ollama, and many more. You bring your own API key; it never leaves your browser except for the per-request call to the provider.

Want to run completely local and offline? Use [llamafile](https://github.com/Mozilla-Ocho/llamafile) — download a single executable, start it, point porchsongs at `llamafile` as the provider, and you're set. No cloud, no API key, no internet required.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Browser (Vanilla HTML/CSS/JS)                         │
│  ┌──────────┬──────────┬──────────┐                    │
│  │ Rewrite  │ Library  │ Profile  │  tabs              │
│  └──────────┴──────────┴──────────┘                    │
│  ┌──────────────────────────────────────────────┐      │
│  │ [Original]  |  [Your Version]                │      │
│  │ [Line Workshop] — click a line, get 3 alts   │      │
│  │ [Chat Workshop] — conversational editing     │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────┬───────────────────────────────────┘
                     │ fetch()
┌────────────────────▼───────────────────────────────────┐
│  FastAPI Backend                                       │
│                                                        │
│  /api/fetch-tab ──► tab_fetcher.py                     │
│  /api/rewrite   ──► llm_service.py (with instruction)  │
│  /api/chat      ──► llm_service.py (multi-turn)        │
│  /api/providers ──► LLMProvider enum (38+ providers)   │
│  /api/verify-connection ──► list_models()              │
│                                                        │
│  /api/profiles ──► SQLite                              │
│  /api/songs    ──► SQLite + SongRevision versioning    │
└────────────────────────────────────────────────────────┘
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./porchsongs.db` | Database connection string |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

## Project Structure

```
porchsongs/
├── pyproject.toml              # uv project config + dependencies
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, static mount
│   │   ├── config.py           # Settings from env vars
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── models.py           # Profile, Song, SongRevision, SubstitutionPattern
│   │   ├── schemas.py          # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── profiles.py     # Profile CRUD
│   │   │   ├── songs.py        # Song library + versioning
│   │   │   └── rewrite.py      # Tab fetch, rewrite, chat, workshop, providers
│   │   └── services/
│   │       ├── llm_service.py  # Prompt construction + any-llm calls
│   │       ├── tab_fetcher.py  # Ultimate Guitar scraper/parser
│   │       └── chord_parser.py # Chord detection + realignment
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js              # Tab routing, settings modal, verify connection
│       ├── api.js              # Backend API client
│       ├── profile.js          # Profile form
│       ├── rewrite.js          # URL/manual input + rewrite flow
│       ├── comparison.js       # Side-by-side diff view
│       ├── workshop.js         # Line-level editing panel
│       ├── chat.js             # Chat-based lyric workshop
│       └── library.js          # Saved songs browser
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
