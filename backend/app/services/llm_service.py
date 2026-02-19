from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from any_llm import LLMProvider, acompletion, alist_models

from .chord_parser import extract_lyrics_only

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterator

    from any_llm.types.completion import ChatCompletion, ChatCompletionChunk
    from sqlalchemy.orm import Session

    from ..models import Song

logger = logging.getLogger(__name__)


def _get_content(response: ChatCompletion | Iterator[ChatCompletionChunk]) -> str:
    """Extract text content from a completion response, raising on empty."""
    content = response.choices[0].message.content  # type: ignore[union-attr]
    if content is None:
        raise ValueError("LLM returned empty response")
    return content


SYSTEM_PROMPT = """You are a songwriter's assistant. You take raw pasted song input (which may include
ads, navigation text, duplicate sections, or formatting artifacts from tab sites) and produce
two clean versions: a cleaned-up original and a personalized rewrite.

STEP 0 — IDENTIFY:
- Determine the song's title and artist from the input
- If you cannot determine either, use "UNKNOWN"

STEP 1 — CLEAN UP:
- Strip any ads, site navigation, duplicate headers, or non-song text
- Preserve chord charts in above-line format (chords on their own line above the lyric line)
- Keep section headers like [Verse], [Chorus], etc.
- Preserve blank lines between sections

STEP 2 — REWRITE:
- Adapt the lyrics so they feel personally relevant to the singer
- Preserve the chord chart format exactly (same chords, same positions)
- SYLLABLE COUNT: Each lyric line MUST have the same number of syllables as the original
- RHYME SCHEME: Keep the exact same rhyme pattern
- THEME & EMOTION: Same emotional arc
- SINGABILITY: Words must sound natural when sung
- MINIMAL CHANGES: Only change what doesn't fit. Leave lines that already work

YOU MUST RESPOND WITH ALL FOUR SECTIONS using these exact XML tags:

<meta>
Title: <song title or UNKNOWN>
Artist: <artist name or UNKNOWN>
</meta>
<original>
(the cleaned-up version of the pasted input — this is critical, do NOT skip this section)
</original>
<rewritten>
(personalized rewrite with chords preserved)
</rewritten>
<changes>
(brief summary of what you changed and why; if title or artist is UNKNOWN, mention this and ask the user to fill them in)
</changes>

All four sections are required. The <original> section must contain the cleaned-up input."""

WORKSHOP_SYSTEM_PROMPT = """You are a songwriter's assistant helping refine individual lyric lines.
You suggest alternatives that:
1. Match the EXACT syllable count of the original line
2. Maintain the rhyme scheme with surrounding lines
3. Sound natural when sung
4. Fit the emotional tone of the song"""

EXTRACTION_SYSTEM_PROMPT = """You extract substitution patterns from song rewrites.
Given original and rewritten lyrics, identify recurring substitution patterns
the user has applied (e.g., changing vehicle types, locations, activities).
Return ONLY valid JSON."""

CHAT_SYSTEM_PROMPT = """You are a songwriter's assistant having a conversation about adapting song lyrics.
The user will ask you to make specific changes to the lyrics. Apply the requested changes while:
1. Preserving syllable counts per line
2. Maintaining rhyme scheme
3. Keeping the song singable and natural
4. Only changing what the user asks for

Return your response in this exact format:

---LYRICS---
(the complete updated lyrics, every line, preserving blank lines and structure)
---END---

(A friendly explanation of what you changed and why)"""

_LOCAL_PROVIDERS = {"ollama", "llamafile", "llamacpp", "lmstudio", "vllm"}


def get_configured_providers() -> list[dict[str, object]]:
    """Return all known providers. Actual validation happens when listing models."""
    return [
        {"name": p.value, "local": p.value in _LOCAL_PROVIDERS}
        for p in LLMProvider
    ]


def get_providers() -> list[str]:
    """Return list of all available provider names."""
    return [p.value for p in LLMProvider]


async def get_models(provider: str, api_base: str | None = None) -> list[str]:
    """Fetch available models for a provider using env-var credentials."""
    kwargs: dict[str, str] = {"provider": provider}
    if api_base:
        kwargs["api_base"] = api_base
    raw = await alist_models(**kwargs)
    return [m.id if hasattr(m, "id") else str(m) for m in raw]


def build_user_prompt(
    profile_description: str,
    title: str | None,
    artist: str | None,
    lyrics: str,
    patterns: list[dict[str, str | None]] | None = None,
    example: dict[str, str] | None = None,
    instruction: str | None = None,
) -> str:
    """Build the user prompt for the LLM, including learned patterns and example."""
    prompt_parts = []

    if profile_description.strip():
        prompt_parts.append("ABOUT THE SINGER:")
        prompt_parts.append(profile_description.strip())
        prompt_parts.append("")

    # Add learned substitution patterns
    if patterns:
        prompt_parts.append("YOUR LEARNED SUBSTITUTION PREFERENCES (from past songs):")
        for p in patterns:
            line = f"- {p['original']} -> {p['replacement']}"
            if p.get("category"):
                line += f" ({p['category']}"
                if p.get("reasoning"):
                    line += f": {p['reasoning']}"
                line += ")"
            prompt_parts.append(line)
        prompt_parts.append("")

    # Add recent completed song example
    if example:
        prompt_parts.append("EXAMPLE OF A PREVIOUS REWRITE:")
        prompt_parts.append("Original:")
        # Truncate to keep within token budget
        orig_lines = example["original_lyrics"].split("\n")[:30]
        prompt_parts.append("\n".join(orig_lines))
        prompt_parts.append("")
        prompt_parts.append("Rewritten:")
        rewrite_lines = example["rewritten_lyrics"].split("\n")[:30]
        prompt_parts.append("\n".join(rewrite_lines))
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
        "Clean up this pasted input (strip any non-song content, formatting artifacts, duplicates) "
        "then rewrite the lyrics to feel like the singer's own life. Same syllable count per line, "
        "same rhyme scheme, same emotions. Preserve chords in above-line format. "
        "Only change imagery/references that don't fit."
    )
    prompt_parts.append("")
    prompt_parts.append("PASTED INPUT:")
    prompt_parts.append(lyrics)
    prompt_parts.append("")
    prompt_parts.append(
        "Use the response format specified in your instructions "
        "(<meta>, <original>, <rewritten>, <changes> XML sections)."
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
    start = max(0, line_index - 3)
    end = min(len(rewrite_lines), line_index + 4)
    context_lines = []
    for i in range(start, end):
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
    patterns: list[dict[str, str | None]] | None = None,
    example: dict[str, str] | None = None,
    instruction: str | None = None,
    api_base: str | None = None,
) -> dict[str, str | None]:
    """Rewrite lyrics using the configured LLM.

    Sends raw pasted input to the LLM which handles cleanup and chord formatting.
    Returns dict with: original_lyrics, rewritten_lyrics, changes_summary, title, artist
    """
    # Build prompt with patterns, example, and instruction — send raw text
    user_prompt = build_user_prompt(
        profile_description, title, artist, lyrics_with_chords, patterns, example, instruction
    )

    # Call the LLM via any-llm-sdk (uses env-var credentials automatically)
    kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }
    if api_base:
        kwargs["api_base"] = api_base
    response = await acompletion(**kwargs)

    raw_response = _get_content(response)

    # Parse the 3-section response format
    return _parse_rewrite_response(raw_response, lyrics_with_chords)


async def rewrite_lyrics_stream(
    profile_description: str,
    title: str | None,
    artist: str | None,
    lyrics_with_chords: str,
    provider: str,
    model: str,
    patterns: list[dict[str, str | None]] | None = None,
    example: dict[str, str] | None = None,
    instruction: str | None = None,
    api_base: str | None = None,
) -> AsyncIterator[str]:
    """Stream a rewrite as SSE events: token chunks then a final done payload."""
    user_prompt = build_user_prompt(
        profile_description, title, artist, lyrics_with_chords, patterns, example, instruction
    )

    kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
        "stream": True,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }
    if api_base:
        kwargs["api_base"] = api_base

    response = await acompletion(**kwargs)

    accumulated = ""
    async for chunk in response:  # type: ignore[union-attr]
        delta = chunk.choices[0].delta  # type: ignore[union-attr]
        token = delta.content if delta and delta.content else ""
        if token:
            accumulated += token
            yield f"data: {json.dumps({'token': token})}\n\n"

    # Parse accumulated text into structured result
    result = _parse_rewrite_response(accumulated, lyrics_with_chords)
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


def _parse_rewrite_response(raw: str, fallback_original: str) -> dict[str, str | None]:
    """Parse the LLM rewrite response.

    Supports two formats:
    - XML tags: <meta>, <original>, <rewritten>, <changes>
    - Legacy delimiters: ---ORIGINAL---/---REWRITTEN---/---CHANGES---

    Returns dict with: original_lyrics, rewritten_lyrics, changes_summary, title, artist
    """
    original_lyrics = fallback_original
    rewritten_lyrics = raw.strip()
    changes_summary = "No change summary provided by the model."
    title: str | None = None
    artist: str | None = None

    # Try XML tags first
    xml_rewritten = _extract_xml_section(raw, "rewritten")
    if xml_rewritten is not None:
        rewritten_lyrics = xml_rewritten

        xml_original = _extract_xml_section(raw, "original")
        if xml_original is not None:
            original_lyrics = xml_original

        xml_changes = _extract_xml_section(raw, "changes")
        if xml_changes is not None:
            changes_summary = xml_changes

        xml_meta = _extract_xml_section(raw, "meta")
        if xml_meta is not None:
            parsed_meta = _parse_meta_section(xml_meta)
            title = parsed_meta["title"]
            artist = parsed_meta["artist"]
    elif "---REWRITTEN---" in raw:
        # Legacy delimiter format
        before_rewritten, after_rewritten = raw.split("---REWRITTEN---", 1)

        if "---ORIGINAL---" in before_rewritten:
            original_lyrics = before_rewritten.split("---ORIGINAL---", 1)[1].strip()

        if "---CHANGES---" in after_rewritten:
            rewritten_block, changes_block = after_rewritten.split("---CHANGES---", 1)
            rewritten_lyrics = rewritten_block.strip()
            changes_summary = changes_block.strip()
        else:
            rewritten_lyrics = after_rewritten.strip()
    elif "---CHANGES---" in raw:
        parts = raw.split("---CHANGES---", 1)
        rewritten_lyrics = parts[0].strip()
        changes_summary = parts[1].strip()

    return {
        "original_lyrics": original_lyrics,
        "rewritten_lyrics": rewritten_lyrics,
        "changes_summary": changes_summary,
        "title": title,
        "artist": artist,
    }


async def workshop_line(
    original_lyrics: str,
    rewritten_lyrics: str,
    line_index: int,
    instruction: str | None,
    provider: str,
    model: str,
    api_base: str | None = None,
) -> dict[str, object]:
    """Get 3 alternative versions of a specific lyric line."""
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
    response = await acompletion(**kwargs)

    raw_response = _get_content(response)

    # Parse the numbered alternatives
    alternatives = []
    for line in raw_response.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        # Match lines starting with 1., 2., 3.
        for prefix in ("1.", "2.", "3."):
            if line.startswith(prefix):
                content = line[len(prefix) :].strip()
                if "|" in content:
                    text, reasoning = content.split("|", 1)
                    alternatives.append(
                        {
                            "text": text.strip(),
                            "reasoning": reasoning.strip(),
                        }
                    )
                else:
                    alternatives.append(
                        {
                            "text": content,
                            "reasoning": "",
                        }
                    )
                break

    # Ensure we return at least something
    if not alternatives:
        alternatives = [{"text": raw_response.strip(), "reasoning": "Could not parse alternatives"}]

    orig_lines = orig_lyrics_only.split("\n")
    rewrite_lines = rewrite_lyrics_only.split("\n")

    return {
        "original_line": orig_lines[line_index] if line_index < len(orig_lines) else "",
        "current_line": rewrite_lines[line_index] if line_index < len(rewrite_lines) else "",
        "alternatives": alternatives[:3],
    }


def _parse_chat_response(raw: str) -> dict[str, str]:
    """Parse chat LLM response, extracting lyrics between markers and explanation."""
    if "---LYRICS---" in raw and "---END---" in raw:
        before_end = raw.split("---END---", 1)
        lyrics_block = before_end[0].split("---LYRICS---", 1)[1].strip()
        explanation = before_end[1].strip() if len(before_end) > 1 else ""
    else:
        # Fallback: treat entire response as lyrics
        lyrics_block = raw.strip()
        explanation = ""

    return {"lyrics": lyrics_block, "explanation": explanation}


async def chat_edit_lyrics(
    song: Song,
    profile_description: str,
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_base: str | None = None,
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


async def extract_patterns(
    song: Song,
    db: Session,
    provider: str,
    model: str,
    api_base: str | None = None,
) -> list[dict[str, str]]:
    """Extract substitution patterns from a completed song and save them.

    Called when a song is marked as 'completed'. Uses env-var credentials.
    """
    from ..models import SubstitutionPattern

    orig_lyrics = extract_lyrics_only(song.original_lyrics)
    rewrite_lyrics = extract_lyrics_only(song.rewritten_lyrics)

    user_prompt = f"""Compare these original and rewritten lyrics. Extract substitution patterns.

ORIGINAL:
{orig_lyrics}

REWRITTEN:
{rewrite_lyrics}

Return a JSON array of objects with these fields:
- "original_term": the original word/phrase
- "replacement_term": what it was changed to
- "category": one of "vehicle", "location", "activity", "person", "food", "drink", "place", "animal", "clothing", "other"
- "reasoning": brief explanation of why this substitution makes sense

Example: [{{"original_term": "F-150", "replacement_term": "Subaru", "category": "vehicle", "reasoning": "user drives a Subaru Outback"}}]

Return ONLY the JSON array, no other text."""

    kwargs: dict[str, object] = {
        "model": model,
        "provider": provider,
        "messages": [
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }
    if api_base:
        kwargs["api_base"] = api_base
    response = await acompletion(**kwargs)

    raw = _get_content(response).strip()

    # Parse JSON — handle potential markdown code blocks
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1])

    try:
        pattern_data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Failed to parse pattern extraction response as JSON")
        return []

    if not isinstance(pattern_data, list):
        return []

    saved = []
    for p in pattern_data:
        if not isinstance(p, dict):
            continue
        original = p.get("original_term", "").strip()
        replacement = p.get("replacement_term", "").strip()
        if not original or not replacement:
            continue

        pattern = SubstitutionPattern(
            profile_id=song.profile_id,
            song_id=song.id,
            original_term=original,
            replacement_term=replacement,
            category=p.get("category", "other"),
            reasoning=p.get("reasoning", ""),
        )
        db.add(pattern)
        saved.append(p)

    if saved:
        db.commit()
        logger.info(f"Extracted {len(saved)} substitution patterns from song {song.id}")

    return saved
