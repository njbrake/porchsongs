from __future__ import annotations

from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from any_llm import LLMProvider, acompletion, alist_models

if TYPE_CHECKING:
    from collections.abc import Iterator

    from any_llm.types.completion import ChatCompletion, ChatCompletionChunk

    from ..models import Song


def _get_content(response: ChatCompletion | Iterator[ChatCompletionChunk]) -> str:
    """Extract text content from a completion response, raising on empty."""
    content = response.choices[0].message.content  # type: ignore[union-attr]
    if content is None:
        raise ValueError("LLM returned empty response")
    return content


CLEAN_SYSTEM_PROMPT = """You are a songwriter's assistant. Your ONLY job is to clean up raw pasted \
song input. Do NOT rewrite or change the lyrics in any way.

STEP 1 — IDENTIFY:
- Determine the song's title and artist from the input
- If you cannot determine either, use "UNKNOWN"

STEP 2 — CLEAN UP:
- Strip any ads, site navigation, duplicate headers, or non-song text
- Keep section headers like [Verse], [Chorus], etc.
- Preserve blank lines between sections
- Do NOT change any lyrics

CHORD PRESERVATION (critical):
- Chords appear on their own line directly ABOVE the lyric line they belong to
- The horizontal spacing of each chord is meaningful — it aligns the chord to a specific \
word or syllable in the lyric line below
- You MUST keep every chord line exactly as-is: same chords, same spacing, same position
- Do NOT reformat, re-space, or merge chord lines
- Example of correct above-line chord format:
    G          C          D
    Amazing grace how sweet the sound
  The spaces before G, C, and D position them above specific words. Preserve this exactly.

Respond with exactly these two XML sections:

<meta>
Title: <song title or UNKNOWN>
Artist: <artist name or UNKNOWN>
</meta>
<original>
(the cleaned-up version of the pasted input with chords and their spacing preserved exactly)
</original>"""


CHAT_SYSTEM_PROMPT = """You are a songwriter's assistant helping adapt a song.
The user will ask you to make specific changes. Apply the requested changes while:
1. Preserving syllable counts per line
2. Maintaining rhyme scheme
3. Keeping the song singable and natural
4. Only changing what the user asks for
5. Preserving chord lines — chords appear on their own line above the lyric they belong to.
   Keep each chord above the same word/syllable. If a word moves, reposition the chord to stay aligned.
6. Preserving all non-lyric content (capo notes, section headers, tuning info, etc.)

Return your response in this exact format:

<lyrics>
(the complete updated song, every line, preserving blank lines, structure, chord lines, and all non-lyric content)
</lyrics>

(A friendly explanation of what you changed and why)"""

_LOCAL_PROVIDERS = {"ollama", "llamafile", "llamacpp", "lmstudio", "vllm"}


def get_configured_providers() -> list[dict[str, object]]:
    """Return all known providers. Actual validation happens when listing models."""
    return [{"name": p.value, "local": p.value in _LOCAL_PROVIDERS} for p in LLMProvider]


async def get_models(provider: str, api_base: str | None = None) -> list[str]:
    """Fetch available models for a provider using env-var credentials."""
    kwargs: dict[str, str] = {"provider": provider}
    if api_base:
        kwargs["api_base"] = api_base
    raw = await alist_models(**kwargs)
    return [m.id if hasattr(m, "id") else str(m) for m in raw]


def _build_parse_kwargs(
    lyrics_with_chords: str,
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, object]:
    """Build the common kwargs dict for parse LLM calls."""
    kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
        "messages": [
            {"role": "system", "content": CLEAN_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Clean up this pasted input. Identify the title and artist.\n\nPASTED INPUT:\n{lyrics_with_chords}",
            },
        ],
    }
    if api_base:
        kwargs["api_base"] = api_base
    if reasoning_effort:
        kwargs["reasoning_effort"] = reasoning_effort
    return kwargs


async def parse_lyrics(
    lyrics_with_chords: str,
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, str | None]:
    """Clean up raw pasted lyrics and identify title/artist (non-streaming).

    Returns dict with: original_lyrics, title, artist
    """
    kwargs = _build_parse_kwargs(lyrics_with_chords, provider, model, api_base, reasoning_effort)
    clean_response = await acompletion(**kwargs)
    clean_result = _parse_clean_response(_get_content(clean_response), lyrics_with_chords)

    return {
        "original_lyrics": clean_result["original"],
        "title": clean_result["title"],
        "artist": clean_result["artist"],
    }


async def parse_lyrics_stream(
    lyrics_with_chords: str,
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> AsyncIterator[str]:
    """Stream parse tokens. Caller accumulates and parses the final result."""
    kwargs = _build_parse_kwargs(lyrics_with_chords, provider, model, api_base, reasoning_effort)
    response = await acompletion(stream=True, **kwargs)

    async for chunk in response:
        delta = chunk.choices[0].delta  # type: ignore[union-attr]
        if delta and delta.content:
            yield delta.content


def _extract_xml_section(raw: str, tag: str) -> str | None:
    """Extract content between <tag> and </tag>, or None if not found."""
    import re

    pattern = re.compile(rf"<{tag}>\s*(.*?)\s*</{tag}>", re.DOTALL)
    m = pattern.search(raw)
    return m.group(1).strip() if m else None


def _parse_meta_section(meta_text: str) -> dict[str, str | None]:
    """Parse title/artist from a meta section. UNKNOWN maps to None."""
    title: str | None = None
    artist: str | None = None
    for line in meta_text.split("\n"):
        line = line.strip()
        if line.lower().startswith("title:"):
            val = line.split(":", 1)[1].strip()
            title = None if val.upper() == "UNKNOWN" else val
        elif line.lower().startswith("artist:"):
            val = line.split(":", 1)[1].strip()
            artist = None if val.upper() == "UNKNOWN" else val
    return {"title": title, "artist": artist}


def _parse_clean_response(raw: str, fallback_original: str) -> dict[str, str | None]:
    """Parse the cleanup LLM response (Call 1).

    Extracts <meta> (title/artist) and <original> (cleaned text).
    Falls back to fallback_original if <original> tag is missing.
    """
    title: str | None = None
    artist: str | None = None

    xml_meta = _extract_xml_section(raw, "meta")
    if xml_meta is not None:
        parsed_meta = _parse_meta_section(xml_meta)
        title = parsed_meta["title"]
        artist = parsed_meta["artist"]

    xml_original = _extract_xml_section(raw, "original")
    original = xml_original if xml_original is not None else fallback_original

    return {"original": original, "title": title, "artist": artist}


def _parse_chat_response(raw: str) -> dict[str, str]:
    """Parse chat LLM response, extracting lyrics from <lyrics> tags and explanation."""
    xml_lyrics = _extract_xml_section(raw, "lyrics")
    if xml_lyrics is not None:
        after = raw.split("</lyrics>", 1)
        explanation = after[1].strip() if len(after) > 1 else ""
        return {"lyrics": xml_lyrics, "explanation": explanation}

    # Fallback: treat entire response as lyrics
    return {"lyrics": raw.strip(), "explanation": ""}


def _build_chat_kwargs(
    song: Song,
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, object]:
    """Build the common kwargs dict for chat LLM calls."""
    system_content = CHAT_SYSTEM_PROMPT
    system_content += "\n\nORIGINAL SONG:\n" + song.original_lyrics
    system_content += "\n\nEDITED SONG:\n" + song.rewritten_lyrics

    llm_messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]
    for msg in messages:
        llm_messages.append({"role": msg["role"], "content": msg["content"]})

    kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
        "messages": llm_messages,
    }
    if api_base:
        kwargs["api_base"] = api_base
    if reasoning_effort:
        kwargs["reasoning_effort"] = reasoning_effort
    return kwargs


async def chat_edit_lyrics(
    song: Song,
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, str]:
    """Process a chat-based lyric edit (non-streaming).

    Builds system context with original + current lyrics and the conversation history,
    sends to LLM, parses the response for updated lyrics.
    """
    kwargs = _build_chat_kwargs(song, messages, provider, model, api_base, reasoning_effort)
    response = await acompletion(**kwargs)

    raw_response = _get_content(response)
    parsed = _parse_chat_response(raw_response)

    # Build a changes summary
    changes_summary = parsed["explanation"] or "Chat edit applied."

    return {
        "rewritten_lyrics": parsed["lyrics"],
        "assistant_message": raw_response,
        "changes_summary": changes_summary,
    }


async def chat_edit_lyrics_stream(
    song: Song,
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> AsyncIterator[str]:
    """Stream a chat-based lyric edit token by token.

    Yields individual token strings as they arrive from the LLM.
    The caller is responsible for accumulating the full text and parsing it.
    """
    kwargs = _build_chat_kwargs(song, messages, provider, model, api_base, reasoning_effort)
    response = await acompletion(stream=True, **kwargs)

    async for chunk in response:
        delta = chunk.choices[0].delta  # type: ignore[union-attr]
        if delta and delta.content:
            yield delta.content
