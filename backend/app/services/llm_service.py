from __future__ import annotations

import json
from typing import TYPE_CHECKING

from any_llm import LLMProvider, acompletion, alist_models

from .chord_parser import extract_lyrics_only, realign_chords

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterator

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

REWRITE_SYSTEM_PROMPT = """You are a songwriter's assistant. You rewrite lyrics so they feel \
personally relevant to the singer.

Rules:
- SYLLABLE COUNT: Each lyric line MUST have the same number of syllables as the original
- RHYME SCHEME: Keep the exact same rhyme pattern
- THEME & EMOTION: Same emotional arc
- SINGABILITY: Words must sound natural when sung
- MINIMAL CHANGES: Only change what doesn't fit. Leave lines that already work
- NO CHORDS: The input contains lyrics only. Do not add chord annotations.
- Preserve section headers like [Verse], [Chorus], etc.
- Preserve blank lines between sections

Respond with exactly these two XML sections:

<lyrics>
(the rewritten lyrics — no chords, just lyrics and section headers)
</lyrics>
<changes>
(brief summary of what you changed and why)
</changes>"""

WORKSHOP_SYSTEM_PROMPT = """You are a songwriter's assistant helping refine individual lyric lines.
You suggest alternatives that:
1. Match the EXACT syllable count of the original line
2. Maintain the rhyme scheme with surrounding lines
3. Sound natural when sung
4. Fit the emotional tone of the song"""

CHAT_SYSTEM_PROMPT = """You are a songwriter's assistant having a conversation about adapting song lyrics.
The user will ask you to make specific changes to the lyrics. Apply the requested changes while:
1. Preserving syllable counts per line
2. Maintaining rhyme scheme
3. Keeping the song singable and natural
4. Only changing what the user asks for

Return your response in this exact format:

<lyrics>
(the complete updated lyrics, every line, preserving blank lines and structure)
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


def build_clean_prompt(lyrics: str) -> str:
    """Build the user prompt for the cleanup LLM call."""
    return f"Clean up this pasted input. Identify the title and artist.\n\nPASTED INPUT:\n{lyrics}"


def build_user_prompt(
    profile_description: str,
    title: str | None,
    artist: str | None,
    lyrics: str,
    instruction: str | None = None,
) -> str:
    """Build the user prompt for the rewrite LLM call.

    Receives lyrics-only text (no chords) for rewriting.
    """
    prompt_parts = []

    if profile_description.strip():
        prompt_parts.append("ABOUT THE SINGER:")
        prompt_parts.append(profile_description.strip())
        prompt_parts.append("")

    song_label = ""
    if title:
        song_label = f'"{title}"'
        if artist:
            song_label += f" by {artist}"
    elif artist:
        song_label = f"by {artist}"

    if song_label:
        prompt_parts.append(f"SONG: {song_label}")
        prompt_parts.append("")

    if instruction:
        prompt_parts.append(f"USER INSTRUCTIONS: {instruction}")
        prompt_parts.append("")

    prompt_parts.append(
        "Rewrite the lyrics to feel like the singer's own life. Same syllable count per line, "
        "same rhyme scheme, same emotions. Only change imagery/references that don't fit."
    )
    prompt_parts.append("")
    prompt_parts.append("LYRICS:")
    prompt_parts.append(lyrics)
    prompt_parts.append("")
    prompt_parts.append(
        "Use the response format specified in your instructions (<lyrics>, <changes> XML sections)."
    )

    return "\n".join(prompt_parts)


def build_workshop_prompt(
    original_lyrics: str,
    rewritten_lyrics: str,
    line_index: int,
    instruction: str | None = None,
) -> str:
    """Build the prompt for line-level workshopping."""
    orig_lines = original_lyrics.split("\n")
    rewrite_lines = rewritten_lyrics.split("\n")

    if line_index < 0 or line_index >= len(rewrite_lines):
        raise IndexError(f"Line index {line_index} out of range (max {len(rewrite_lines) - 1})")

    original_line = orig_lines[line_index] if line_index < len(orig_lines) else ""
    current_line = rewrite_lines[line_index]

    # Get context: 3 lines above and below
    ctx_start = max(0, line_index - 3)
    ctx_end = min(len(rewrite_lines), line_index + 4)
    context_lines = []
    for i in range(ctx_start, ctx_end):
        marker = " >>> " if i == line_index else "     "
        context_lines.append(f"{marker}{rewrite_lines[i]}")

    prompt_parts = [
        "I need 3 alternative versions of a specific lyric line.",
        "",
        "CONTEXT (surrounding lines):",
        "\n".join(context_lines),
        "",
        f"ORIGINAL LINE (for syllable reference): {original_line}",
        f"CURRENT LINE TO REPLACE: {current_line}",
    ]

    if instruction:
        prompt_parts.append(f"USER INSTRUCTION: {instruction}")

    prompt_parts.extend(
        [
            "",
            "Provide exactly 3 alternatives. Each must match the syllable count of the ORIGINAL line.",
            "Format your response as:",
            "1. [alternative text] | [brief reasoning]",
            "2. [alternative text] | [brief reasoning]",
            "3. [alternative text] | [brief reasoning]",
        ]
    )

    return "\n".join(prompt_parts)


async def rewrite_lyrics(
    profile_description: str,
    title: str | None,
    artist: str | None,
    lyrics_with_chords: str,
    provider: str,
    model: str,
    instruction: str | None = None,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, str | None]:
    """Rewrite lyrics using 2 sequential LLM calls.

    Call 1: Clean up raw input, identify title/artist.
    Call 2: Rewrite lyrics (chords stripped, handled programmatically).
    Returns dict with: original_lyrics, rewritten_lyrics, changes_summary, title, artist
    """
    base_kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
    }
    if api_base:
        base_kwargs["api_base"] = api_base
    if reasoning_effort:
        base_kwargs["reasoning_effort"] = reasoning_effort

    # --- Call 1: Clean + Identify ---
    clean_response = await acompletion(
        **base_kwargs,
        messages=[
            {"role": "system", "content": CLEAN_SYSTEM_PROMPT},
            {"role": "user", "content": build_clean_prompt(lyrics_with_chords)},
        ],
    )
    clean_result = _parse_clean_response(_get_content(clean_response), lyrics_with_chords)
    clean_text = clean_result["original"]
    meta_title = title or clean_result["title"]
    meta_artist = artist or clean_result["artist"]

    # --- Strip chords for rewrite ---
    lyrics_only = extract_lyrics_only(clean_text)

    # --- Call 2: Rewrite ---
    rewrite_prompt = build_user_prompt(
        profile_description, meta_title, meta_artist, lyrics_only, instruction
    )
    rewrite_response = await acompletion(
        **base_kwargs,
        messages=[
            {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
            {"role": "user", "content": rewrite_prompt},
        ],
    )
    rewrite_result = _parse_rewrite_response(_get_content(rewrite_response), lyrics_only)

    # --- Realign chords programmatically ---
    rewritten_with_chords = realign_chords(clean_text, rewrite_result["rewritten_lyrics"])

    return {
        "original_lyrics": clean_text,
        "rewritten_lyrics": rewritten_with_chords,
        "changes_summary": rewrite_result["changes_summary"],
        "title": meta_title,
        "artist": meta_artist,
    }


async def rewrite_lyrics_stream(
    profile_description: str,
    title: str | None,
    artist: str | None,
    lyrics_with_chords: str,
    provider: str,
    model: str,
    instruction: str | None = None,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> AsyncIterator[str]:
    """Stream a rewrite as SSE events with phase indicators.

    Call 1 (non-streaming): Clean + Identify
    Call 2 (streaming): Rewrite lyrics
    Post-processing: Realign chords programmatically
    """
    base_kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
    }
    if api_base:
        base_kwargs["api_base"] = api_base
    if reasoning_effort:
        base_kwargs["reasoning_effort"] = reasoning_effort

    # --- Phase 1: Clean + Identify (non-streaming) ---
    yield f"data: {json.dumps({'phase': 'cleaning'})}\n\n"
    clean_response = await acompletion(
        **base_kwargs,
        messages=[
            {"role": "system", "content": CLEAN_SYSTEM_PROMPT},
            {"role": "user", "content": build_clean_prompt(lyrics_with_chords)},
        ],
    )
    clean_result = _parse_clean_response(_get_content(clean_response), lyrics_with_chords)
    clean_text = clean_result["original"]
    meta_title = title or clean_result["title"]
    meta_artist = artist or clean_result["artist"]

    # --- Strip chords for rewrite ---
    lyrics_only = extract_lyrics_only(clean_text)

    # --- Phase 2: Rewrite (streaming) ---
    yield f"data: {json.dumps({'phase': 'rewriting'})}\n\n"
    rewrite_prompt = build_user_prompt(
        profile_description, meta_title, meta_artist, lyrics_only, instruction
    )
    response = await acompletion(
        **base_kwargs,
        stream=True,
        messages=[
            {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
            {"role": "user", "content": rewrite_prompt},
        ],
    )

    accumulated = ""
    thinking_started = False
    async for chunk in response:  # type: ignore[union-attr]
        delta = chunk.choices[0].delta  # type: ignore[union-attr]
        token = delta.content if delta and delta.content else ""
        if token:
            accumulated += token
            yield f"data: {json.dumps({'token': token})}\n\n"
        elif not thinking_started and hasattr(delta, "reasoning") and delta.reasoning:
            thinking_started = True
            yield f"data: {json.dumps({'thinking': True})}\n\n"

    # Parse accumulated rewrite response
    rewrite_result = _parse_rewrite_response(accumulated, lyrics_only)

    # --- Post-processing: Realign chords ---
    rewritten_with_chords = realign_chords(clean_text, rewrite_result["rewritten_lyrics"])

    result: dict[str, str | None] = {
        "original_lyrics": clean_text,
        "rewritten_lyrics": rewritten_with_chords,
        "changes_summary": rewrite_result["changes_summary"],
        "title": meta_title,
        "artist": meta_artist,
    }
    yield f"data: {json.dumps({'done': True, 'result': result})}\n\n"


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


def _parse_rewrite_response(raw: str, fallback_lyrics: str) -> dict[str, str]:
    """Parse the rewrite LLM response (Call 2).

    Extracts <lyrics> and <changes> XML sections.
    Returns dict with: rewritten_lyrics, changes_summary
    """
    rewritten_lyrics = raw.strip()
    changes_summary = "No change summary provided by the model."

    xml_lyrics = _extract_xml_section(raw, "lyrics")
    if xml_lyrics is not None:
        rewritten_lyrics = xml_lyrics

        xml_changes = _extract_xml_section(raw, "changes")
        if xml_changes is not None:
            changes_summary = xml_changes
    elif not rewritten_lyrics:
        rewritten_lyrics = fallback_lyrics

    return {
        "rewritten_lyrics": rewritten_lyrics,
        "changes_summary": changes_summary,
    }


def _parse_alternatives(raw_response: str) -> list[dict[str, str]]:
    """Parse numbered alternatives from LLM response."""
    alternatives: list[dict[str, str]] = []
    for line in raw_response.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        for prefix in ("1.", "2.", "3."):
            if line.startswith(prefix):
                content = line[len(prefix) :].strip()
                if "|" in content:
                    text, reasoning = content.split("|", 1)
                    alternatives.append({"text": text.strip(), "reasoning": reasoning.strip()})
                else:
                    alternatives.append({"text": content, "reasoning": ""})
                break
    return alternatives


async def workshop_line(
    original_lyrics: str,
    rewritten_lyrics: str,
    line_index: int,
    instruction: str | None,
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, object]:
    """Get 3 alternative versions of a single lyric line."""
    # Work with lyrics-only (no chords) for the LLM
    orig_lyrics_only = extract_lyrics_only(original_lyrics)
    rewrite_lyrics_only = extract_lyrics_only(rewritten_lyrics)

    user_prompt = build_workshop_prompt(
        orig_lyrics_only, rewrite_lyrics_only, line_index, instruction
    )

    kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
        "messages": [
            {"role": "system", "content": WORKSHOP_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }
    if api_base:
        kwargs["api_base"] = api_base
    if reasoning_effort:
        kwargs["reasoning_effort"] = reasoning_effort
    response = await acompletion(**kwargs)

    raw_response = _get_content(response)
    alternatives = _parse_alternatives(raw_response)

    # Ensure we return at least something
    if not alternatives:
        alternatives = [{"text": raw_response.strip(), "reasoning": "Could not parse alternatives"}]

    orig_lines = orig_lyrics_only.split("\n")
    rewrite_lines = rewrite_lyrics_only.split("\n")

    original_line = orig_lines[line_index] if line_index < len(orig_lines) else ""
    current_line = rewrite_lines[line_index] if line_index < len(rewrite_lines) else ""

    return {
        "original_line": original_line,
        "current_line": current_line,
        "alternatives": alternatives[:3],
    }


def _parse_chat_response(raw: str) -> dict[str, str]:
    """Parse chat LLM response, extracting lyrics between markers and explanation."""
    # Prefer XML tags
    xml_lyrics = _extract_xml_section(raw, "lyrics")
    if xml_lyrics is not None:
        # Everything after </lyrics> is the explanation
        after = raw.split("</lyrics>", 1)
        explanation = after[1].strip() if len(after) > 1 else ""
        return {"lyrics": xml_lyrics, "explanation": explanation}

    # Legacy delimiter fallback
    if "---LYRICS---" in raw and "---END---" in raw:
        before_end = raw.split("---END---", 1)
        lyrics_block = before_end[0].split("---LYRICS---", 1)[1].strip()
        explanation = before_end[1].strip() if len(before_end) > 1 else ""
        return {"lyrics": lyrics_block, "explanation": explanation}

    # Fallback: treat entire response as lyrics
    return {"lyrics": raw.strip(), "explanation": ""}


async def chat_edit_lyrics(
    song: Song,
    profile_description: str,
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_base: str | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, str]:
    """Process a chat-based lyric edit.

    Builds a multi-turn conversation with system context, sends to LLM,
    parses the response for updated lyrics. The LLM handles chord formatting directly.
    """
    # Build the messages array for the LLM
    system_content = CHAT_SYSTEM_PROMPT
    if profile_description.strip():
        system_content += "\n\nABOUT THE SINGER:\n" + profile_description.strip()
    system_content += "\n\nCURRENT LYRICS:\n" + song.rewritten_lyrics

    llm_messages = [{"role": "system", "content": system_content}]
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
