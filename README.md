# PorchSongs

Personal song lyric rewriter. Paste an Ultimate Guitar link, and PorchSongs rewrites the lyrics with imagery from your own life — your neighborhood, your family, your daily routine — while preserving meter, rhyme scheme, chord alignment, and emotional meaning.

Built for anyone who loves singing along but wants the words to feel like theirs.

## How It Works

1. **Create a profile** describing your life (where you live, hobbies, family, favorite spots)
2. **Paste an Ultimate Guitar URL** — the app fetches the song title, artist, chords, and lyrics automatically
3. **The LLM rewrites** only the imagery that doesn't fit your life, keeping syllable counts, rhyme schemes, and emotions intact
4. **Chords are realigned** above the new lyrics automatically
5. **Save rewrites** to your library for later

## Quick Start

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000).

You'll need an API key from any supported LLM provider — configure it via the gear icon in the app header.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Access at [http://localhost:8000](http://localhost:8000).

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (Vanilla HTML/CSS/JS)                  │
│  ┌───────────┬───────────┬───────────┐          │
│  │  Rewrite  │  Library  │  Profile  │  tabs    │
│  └───────────┴───────────┴───────────┘          │
└──────────────────┬──────────────────────────────┘
                   │ fetch()
┌──────────────────▼──────────────────────────────┐
│  FastAPI Backend                                │
│                                                 │
│  /api/fetch-tab ──► tab_fetcher.py              │
│       Scrapes Ultimate Guitar, extracts JSON    │
│       from js-store, cleans [ch]/[tab] markup   │
│                                                 │
│  /api/rewrite ──► chord_parser.py               │
│       Separates chords from lyrics, sends only  │
│       lyrics to LLM, realigns chords after      │
│                   │                             │
│                   ▼                             │
│              llm_service.py                     │
│       Builds prompt with profile context,       │
│       calls any-llm-sdk (40+ LLM providers),   │
│       parses response + change summary          │
│                                                 │
│  /api/profiles ──► SQLite (profiles table)      │
│  /api/songs    ──► SQLite (songs table)         │
└─────────────────────────────────────────────────┘
```

### Backend (`backend/`)

- **FastAPI** app serving both the API and the static frontend
- **SQLAlchemy** + SQLite for profiles and saved songs (zero-config, portable)
- **any-llm-sdk** for LLM calls — supports OpenAI, Anthropic, Google, Mistral, Ollama, and more. The user provides their own API key via the browser; it's sent per-request and never stored server-side
- **Tab fetcher** parses Ultimate Guitar pages by extracting the JSON blob from the `js-store` div
- **Chord parser** detects chord-only lines, maps chord positions to character offsets, and proportionally remaps them onto rewritten lyrics with word-boundary snapping

### Frontend (`frontend/`)

- Single-page app with three tabs: Rewrite, Library, Profile
- LLM provider/model/key stored in `localStorage`
- Side-by-side comparison view with chord highlighting and changed-line highlighting

## Supported LLM Providers

Configured via the settings modal in the app header:

| Provider | Example Models |
|----------|---------------|
| OpenAI | gpt-4o, gpt-4o-mini |
| Anthropic | claude-sonnet-4-5, claude-haiku-4-5 |
| Google | gemini-2.0-flash, gemini-1.5-pro |
| Mistral | mistral-large-latest |
| Ollama | llama3, mistral (local) |

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./porchsongs.db` | Database connection string |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

## Project Structure

```
PorchSongs/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, static mount
│   │   ├── config.py            # Settings from env vars
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # Profile and Song ORM models
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── profiles.py      # Profile CRUD
│   │   │   ├── songs.py         # Song library CRUD
│   │   │   └── rewrite.py       # Tab fetch + LLM rewrite
│   │   └── services/
│   │       ├── llm_service.py   # Prompt construction + any-llm calls
│   │       ├── tab_fetcher.py   # Ultimate Guitar scraper/parser
│   │       └── chord_parser.py  # Chord detection + realignment
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js               # Tab routing, settings modal
│       ├── api.js               # Backend API client
│       ├── profile.js           # Profile form
│       ├── rewrite.js           # URL/manual input + rewrite flow
│       ├── comparison.js        # Side-by-side diff view
│       └── library.js           # Saved songs browser
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
