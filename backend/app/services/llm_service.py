from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from any_llm import LLMProvider, completion, list_models

from .chord_parser import extract_lyrics_only, realign_chords

if TYPE_CHECKING:
    from collections.abc import Iterator

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


SYSTEM_PROMPT = """You are a songwriter's assistant. You adapt song lyrics so they feel personally
relevant to the singer while preserving the song's musical structure perfectly.

ABSOLUTE RULES:
1. SYLLABLE COUNT: Each line MUST have the same number of syllables as the original.
2. RHYME SCHEME: Keep the exact same rhyme pattern.
3. THEME & EMOTION: Same emotional arc. A love verse stays love. Nostalgia stays nostalgic.
4. SINGABILITY: Words must sound natural when sung. No forced rhymes.
5. MINIMAL CHANGES: Only change what doesn't fit. Leave lines that already work."""

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


def get_providers() -> list[str]:
    """Return list of all available provider names from the LLMProvider enum."""
    return [p.value for p in LLMProvider]


def get_models(provider: str, api_key: str, api_base: str | None = None) -> list[str]:
    """Fetch available models for a provider using the provided API key."""
    raw = list_models(provider=provider, api_key=api_key, api_base=api_base or None)
    return [m.id if hasattr(m, "id") else str(m) for m in raw]


def build_user_prompt(
    profile: dict[str, str | None],
    title: str | None,
    artist: str | None,
    lyrics: str,
    patterns: list[dict[str, str | None]] | None = None,
    example: dict[str, str] | None = None,
    instruction: str | None = None,
) -> str:
    """Build the user prompt for the LLM, including learned patterns and example."""
    prompt_parts = ["ABOUT THE SINGER:"]

    if profile.get("location_description"):
        prompt_parts.append(f"- Lives in: {profile['location_description']}")
    if profile.get("location_type"):
        prompt_parts.append(f"- Setting: {profile['location_type']}")
    if profile.get("occupation"):
        prompt_parts.append(f"- Works as: {profile['occupation']}")
    if profile.get("hobbies"):
        prompt_parts.append(f"- Hobbies: {profile['hobbies']}")
    if profile.get("family_situation"):
        prompt_parts.append(f"- Family: {profile['family_situation']}")
    if profile.get("daily_routine"):
        prompt_parts.append(f"- Daily life: {profile['daily_routine']}")
    if profile.get("custom_references"):
        prompt_parts.append(f"- Wants referenced: {profile['custom_references']}")

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
        "Rewrite these lyrics to feel like the singer's own life. Same syllable count per line, "
        "same rhyme scheme, same emotions. Only change imagery/references that don't fit."
    )
    prompt_parts.append("")
    prompt_parts.append("ORIGINAL LYRICS:")
    prompt_parts.append(lyrics)
    prompt_parts.append("")
    prompt_parts.append(
        "Return ONLY the rewritten lyrics (one line per original line, same line count).\n"
        'Then add "---CHANGES---" followed by a brief list of what you changed and why.'
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
    profile: dict[str, str | None],
    title: str | None,
    artist: str | None,
    lyrics_with_chords: str,
    provider: str,
    model: str,
    api_key: str,
    patterns: list[dict[str, str | None]] | None = None,
    example: dict[str, str] | None = None,
    instruction: str | None = None,
    api_base: str | None = None,
) -> dict[str, str]:
    """Rewrite lyrics using the configured LLM.

    Returns dict with: original_lyrics, rewritten_lyrics, changes_summary
    """
    # Separate chords from lyrics
    lyrics_only = extract_lyrics_only(lyrics_with_chords)

    # Build prompt with patterns, example, and instruction
    user_prompt = build_user_prompt(
        profile, title, artist, lyrics_only, patterns, example, instruction
    )

    # Call the LLM via any-llm-sdk
    response = completion(
        model=model,
        provider=provider,
        api_key=api_key,
        api_base=api_base or None,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    raw_response = _get_content(response)

    # Parse the response: split on ---CHANGES---
    if "---CHANGES---" in raw_response:
        parts = raw_response.split("---CHANGES---", 1)
        rewritten_lyrics_only = parts[0].strip()
        changes_summary = parts[1].strip()
    else:
        rewritten_lyrics_only = raw_response.strip()
        changes_summary = "No change summary provided by the model."

    # Realign chords above the rewritten lyrics
    rewritten_with_chords = realign_chords(lyrics_with_chords, rewritten_lyrics_only)

    return {
        "original_lyrics": lyrics_with_chords,
        "rewritten_lyrics": rewritten_with_chords,
        "changes_summary": changes_summary,
    }


async def workshop_line(
    original_lyrics: str,
    rewritten_lyrics: str,
    line_index: int,
    instruction: str | None,
    provider: str,
    model: str,
    api_key: str,
    api_base: str | None = None,
) -> dict[str, object]:
    """Get 3 alternative versions of a specific lyric line."""
    # Work with lyrics-only (no chords) for the LLM
    orig_lyrics_only = extract_lyrics_only(original_lyrics)
    rewrite_lyrics_only = extract_lyrics_only(rewritten_lyrics)

    user_prompt = build_workshop_prompt(
        orig_lyrics_only, rewrite_lyrics_only, line_index, instruction
    )

    response = completion(
        model=model,
        provider=provider,
        api_key=api_key,
        api_base=api_base or None,
        messages=[
            {"role": "system", "content": WORKSHOP_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

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
    profile: dict[str, str | None],
    messages: list[dict[str, str]],
    provider: str,
    model: str,
    api_key: str,
    api_base: str | None = None,
) -> dict[str, str]:
    """Process a chat-based lyric edit.

    Builds a multi-turn conversation with system context, sends to LLM,
    parses the response for updated lyrics, and realigns chords.
    """
    current_lyrics_only = extract_lyrics_only(song.rewritten_lyrics)

    # Build the messages array for the LLM
    system_content = CHAT_SYSTEM_PROMPT + "\n\nCURRENT LYRICS:\n" + current_lyrics_only

    llm_messages = [{"role": "system", "content": system_content}]
    for msg in messages:
        llm_messages.append({"role": msg["role"], "content": msg["content"]})

    response = completion(
        model=model,
        provider=provider,
        api_key=api_key,
        api_base=api_base or None,
        messages=llm_messages,
    )

    raw_response = _get_content(response)
    parsed = _parse_chat_response(raw_response)

    # Realign chords from current version onto new lyrics
    rewritten_with_chords = realign_chords(song.rewritten_lyrics, parsed["lyrics"])

    # Build a changes summary
    changes_summary = parsed["explanation"] or "Chat edit applied."

    return {
        "rewritten_lyrics": rewritten_with_chords,
        "assistant_message": raw_response,
        "changes_summary": changes_summary,
    }


async def extract_and_save_patterns(song: Song, db: Session) -> list[dict[str, str]]:
    """Extract substitution patterns from a completed song and save them.

    Called when a song is marked as 'completed'.
    Requires the song to have both original and rewritten lyrics.
    Uses the same LLM settings — we need api_key, so we use a lightweight approach:
    try to find a key from localStorage sent in recent requests, or skip.
    """

    # This is a no-op placeholder — extraction requires an API key which must be
    # passed from the frontend. Use extract_patterns_with_key() instead.
    logger.info("Pattern extraction skipped (no API key available server-side)")
    return []


async def extract_patterns_with_key(
    song: Song,
    db: Session,
    provider: str,
    model: str,
    api_key: str,
    api_base: str | None = None,
) -> list[dict[str, str]]:
    """Extract substitution patterns using provided API credentials."""
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

    response = completion(
        model=model,
        provider=provider,
        api_key=api_key,
        api_base=api_base or None,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

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
