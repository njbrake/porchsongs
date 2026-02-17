# porchsongs

A personal song lyric rewriter. Paste a chord chart, chat with an AI to workshop the lyrics into your own life, and play a song that actually sounds like you.

porchsongs preserves meter, rhyme scheme, chord alignment, and emotional meaning — it only swaps out the imagery that doesn't fit.

## How It Works

1. **Find a chord chart** — paste an Ultimate Guitar link (or type lyrics manually)
2. **Chat to workshop the lyrics** — tell the AI what to change ("swap the truck for my bike," "make verse 2 about coding") and iterate in a live conversation
3. **Play and enjoy** — chords are automatically realigned above your new lyrics

## Quick Start

```bash
pip install uv
uv sync
cd frontend && npm install && npm run build && cd ..
cd backend
uv run uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000). Configure your LLM API key in Settings (gear icon).

For frontend development with hot reload, run `npm run dev` in `frontend/` (proxies API calls to the backend).

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## LLM Providers

Built on [any-llm](https://github.com/abhaymathur21/any-llm) — 38+ providers including OpenAI, Anthropic, Google, Mistral, Groq, and Ollama. Bring your own API key.

For fully local/offline use, try [llamafile](https://github.com/Mozilla-Ocho/llamafile).
