<p align="center">
  <img src="frontend/public/logo.svg" alt="porchsongs" width="120" />
</p>

<h1 align="center">porchsongs</h1>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/python-3.11+-blue?logo=python&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/react-19-61dafb?logo=react&logoColor=white" />
  <img alt="FastAPI" src="https://img.shields.io/badge/fastapi-0.115-009688?logo=fastapi&logoColor=white" />
  <img alt="any-llm" src="https://img.shields.io/badge/LLM_providers-38+-c06830" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
</p>

<p align="center">
  A personal song lyric rewriter. Paste a chord chart, chat with an AI to workshop the lyrics into your own life, and play a song that actually sounds like you.
</p>

---

<p align="center">
  <img src="assets/porchsongs-demo.gif" alt="PorchSongs demo" width="720" />
</p>

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
