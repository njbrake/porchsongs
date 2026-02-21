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
song input. Do NOT rewrite or change the content in any way.

STEP 1 — IDENTIFY:
- Determine the song's title and artist from the input
- If you cannot determine either, use "UNKNOWN"

STEP 2 — CLEAN UP:
- Strip any ads, site navigation, duplicate headers, or non-song text
- Keep section headers like [Verse], [Chorus], etc.
- Preserve blank lines between sections
- Do NOT change any content

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
You can have a normal conversation — answer questions, discuss options, brainstorm ideas.

When the user wants changes to the song, go ahead and make them. You don't need an explicit \
"rewrite it" command — if the user's message implies a change (e.g. "the second verse feels \
too wordy", "can we make this more upbeat?", "I don't like line 3"), apply the edit directly. \
Bias toward action: rewrite first, explain after.

When making changes:
1. Preserve syllable counts per line
2. Maintain rhyme scheme
3. Keep the song singable and natural
4. Only change what the user is asking about
5. Preserve chord lines — chords appear on their own line above the lyric they belong to.
   Keep each chord above the same word/syllable. If a word moves, reposition the chord to stay aligned.
6. Preserve all non-lyric content (capo notes, section headers, tuning info, etc.)

IMPORTANT — only include <content> tags when you are actually changing the song:

<content>
(the complete updated song, every line, preserving blank lines, structure, chord lines, and all non-lyric content)
</content>

(A friendly explanation of what you changed and why)

If the user is purely asking a question or brainstorming without implying any specific edit, \
respond conversationally WITHOUT <content> tags."""

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
    content: str,
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
    instruction: str | None = None,
) -> dict[str, object]:
    """Build the common kwargs dict for parse LLM calls."""
    user_text = "Clean up this pasted input. Identify the title and artist."
    if instruction:
        user_text += f"\n\nUSER INSTRUCTIONS:\n{instruction}"
    user_text += f"\n\nPASTED INPUT:\n{content}"

    kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
        "messages": [
            {"role": "system", "content": CLEAN_SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
    }
    if api_base:
        kwargs["api_base"] = api_base
    if reasoning_effort:
        kwargs["reasoning_effort"] = reasoning_effort
    return kwargs


async def parse_content(
    content: str,
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
    instruction: str | None = None,
) -> dict[str, str | None]:
    """Clean up raw pasted content and identify title/artist (non-streaming).

    Returns dict with: original_content, title, artist
    """
    kwargs = _build_parse_kwargs(content, provider, model, api_base, reasoning_effort, instruction)
    clean_response = await acompletion(**kwargs)
    clean_result = _parse_clean_response(_get_content(clean_response), content)

    return {
        "original_content": clean_result["original"],
        "title": clean_result["title"],
        "artist": clean_result["artist"],
    }


async def parse_content_stream(
    content: str,
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
    instruction: str | None = None,
) -> AsyncIterator[str]:
    """Stream parse tokens. Caller accumulates and parses the final result."""
    kwargs = _build_parse_kwargs(content, provider, model, api_base, reasoning_effort, instruction)
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


def _parse_chat_response(raw: str) -> dict[str, str | None]:
    """Parse chat LLM response, extracting content from <content> tags and explanation.

    Returns ``{"content": ..., "explanation": ...}`` where ``content`` is ``None``
    when the LLM responded conversationally without ``<content>`` tags.
    """
    xml_content = _extract_xml_section(raw, "content")
    if xml_content is not None:
        after = raw.split("</content>", 1)
        explanation = after[1].strip() if len(after) > 1 else ""
        return {"content": xml_content, "explanation": explanation}

    # No <content> tags → conversational response, no content update
    return {"content": None, "explanation": raw.strip()}


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
    system_content += "\n\nORIGINAL SONG:\n" + song.original_content
    system_content += "\n\nEDITED SONG:\n" + song.rewritten_content

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


async def chat_edit_content(
    song: Song,
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, str | None]:
    """Process a chat-based content edit (non-streaming).

    Builds system context with original + current content and the conversation history,
    sends to LLM, parses the response for updated content.

    ``rewritten_content`` is ``None`` when the LLM responded conversationally
    without ``<content>`` tags.
    """
    kwargs = _build_chat_kwargs(song, messages, provider, model, api_base, reasoning_effort)
    response = await acompletion(**kwargs)

    raw_response = _get_content(response)
    parsed = _parse_chat_response(raw_response)

    # Build a changes summary
    changes_summary = parsed["explanation"] or "Chat edit applied."

    return {
        "rewritten_content": parsed["content"],
        "assistant_message": raw_response,
        "changes_summary": changes_summary,
    }


async def chat_edit_content_stream(
    song: Song,
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> AsyncIterator[str]:
    """Stream a chat-based content edit token by token.

    Yields individual token strings as they arrive from the LLM.
    The caller is responsible for accumulating the full text and parsing it.
    """
    kwargs = _build_chat_kwargs(song, messages, provider, model, api_base, reasoning_effort)
    response = await acompletion(stream=True, **kwargs)

    async for chunk in response:
        delta = chunk.choices[0].delta  # type: ignore[union-attr]
        if delta and delta.content:
            yield delta.content
