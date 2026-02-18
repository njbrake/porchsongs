from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ChatMessage as ChatMessageModel
from ..models import Profile, Song
from ..schemas import (
    ChatRequest,
    ChatResponse,
    RewriteRequest,
    RewriteResponse,
    WorkshopLineRequest,
    WorkshopLineResponse,
)
from ..services import llm_service

router = APIRouter()


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(req: RewriteRequest, db: Session = Depends(get_db)) -> dict[str, str | None]:
    # Load profile
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile_description = profile.description or ""

    # Pass raw lyrics directly — the LLM handles cleanup and chord formatting
    lyrics = req.lyrics

    # Load substitution patterns for this profile
    from ..models import SubstitutionPattern

    patterns = (
        db.query(SubstitutionPattern).filter(SubstitutionPattern.profile_id == req.profile_id).all()
    )
    pattern_list = [
        {
            "original": p.original_term,
            "replacement": p.replacement_term,
            "category": p.category,
            "reasoning": p.reasoning,
        }
        for p in patterns
    ]

    # Load one recent completed song as example
    recent_completed = (
        db.query(Song)
        .filter(Song.profile_id == req.profile_id, Song.status == "completed")
        .order_by(Song.created_at.desc())
        .first()
    )
    example = None
    if recent_completed:
        example = {
            "original_lyrics": recent_completed.original_lyrics,
            "rewritten_lyrics": recent_completed.rewritten_lyrics,
        }

    try:
        result = await llm_service.rewrite_lyrics(
            profile_description=profile_description,
            title=req.title,
            artist=req.artist,
            lyrics_with_chords=lyrics,
            provider=req.provider,
            model=req.model,
            patterns=pattern_list,
            example=example,
            instruction=req.instruction,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from None

    # Merge fallback: if LLM didn't extract title/artist, use request values
    if result.get("title") is None and req.title:
        result["title"] = req.title
    if result.get("artist") is None and req.artist:
        result["artist"] = req.artist

    return result


@router.post("/workshop-line", response_model=WorkshopLineResponse)
async def workshop_line(
    req: WorkshopLineRequest, db: Session = Depends(get_db)
) -> dict[str, object]:
    song = db.query(Song).filter(Song.id == req.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    try:
        result = await llm_service.workshop_line(
            original_lyrics=song.original_lyrics,
            rewritten_lyrics=song.rewritten_lyrics,
            line_index=req.line_index,
            instruction=req.instruction,
            provider=req.provider,
            model=req.model,
        )
    except IndexError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from None

    return result


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    from ..models import SongRevision

    song = db.query(Song).filter(Song.id == req.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    profile = db.query(Profile).filter(Profile.id == song.profile_id).first()
    profile_description = profile.description if profile else ""

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        result = await llm_service.chat_edit_lyrics(
            song=song,
            profile_description=profile_description or "",
            messages=messages,
            provider=req.provider,
            model=req.model,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from None

    # Persist the updated lyrics
    song.rewritten_lyrics = result["rewritten_lyrics"]
    song.changes_summary = result["changes_summary"]
    song.current_version += 1

    revision = SongRevision(
        song_id=song.id,
        version=song.current_version,
        rewritten_lyrics=result["rewritten_lyrics"],
        changes_summary=result["changes_summary"],
        edit_type="chat",
    )
    db.add(revision)

    # Persist the user and assistant chat messages
    last_user_msg = req.messages[-1] if req.messages else None
    if last_user_msg and last_user_msg.role == "user":
        db.add(
            ChatMessageModel(
                song_id=song.id, role="user", content=last_user_msg.content, is_note=False
            )
        )
    db.add(
        ChatMessageModel(
            song_id=song.id, role="assistant", content=result["changes_summary"], is_note=False
        )
    )

    db.commit()

    return ChatResponse(
        rewritten_lyrics=result["rewritten_lyrics"],
        assistant_message=result["assistant_message"],
        changes_summary=result["changes_summary"],
        version=song.current_version,
    )


@router.get("/providers")
def list_providers() -> list[dict[str, str | None]]:
    return llm_service.get_configured_providers()


@router.get("/providers/{provider}/models")
async def list_provider_models(provider: str) -> list[str]:
    try:
        return await llm_service.get_models(provider)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from None
