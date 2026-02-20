from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..auth.scoping import get_user_profile, get_user_song
from ..database import get_db
from ..models import ChatMessage as ChatMessageModel
from ..models import ProfileModel, ProviderConnection, User
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


def _lookup_api_base(
    db: Session, profile_id: int | None, provider: str | None, model: str | None
) -> str | None:
    """Look up api_base: prefer ProviderConnection, fall back to ProfileModel."""
    if not profile_id or not provider:
        return None
    conn = (
        db.query(ProviderConnection)
        .filter(
            ProviderConnection.profile_id == profile_id,
            ProviderConnection.provider == provider,
        )
        .first()
    )
    if conn and conn.api_base:
        return conn.api_base
    # Backward compat: check ProfileModel
    if model:
        pm = (
            db.query(ProfileModel)
            .filter(
                ProfileModel.profile_id == profile_id,
                ProfileModel.provider == provider,
                ProfileModel.model == model,
            )
            .first()
        )
        if pm and pm.api_base:
            return pm.api_base
    return None


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(
    req: RewriteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    stream: bool = Query(default=False),
) -> dict[str, str | None] | StreamingResponse:
    profile = get_user_profile(db, current_user, req.profile_id)
    profile_description = profile.description or ""
    lyrics = req.lyrics
    api_base = _lookup_api_base(db, req.profile_id, req.provider, req.model)

    if stream:
        generator = llm_service.rewrite_lyrics_stream(
            profile_description=profile_description,
            title=req.title,
            artist=req.artist,
            lyrics_with_chords=lyrics,
            provider=req.provider,
            model=req.model,
            instruction=req.instruction,
            api_base=api_base,
            reasoning_effort=req.reasoning_effort,
        )
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        result = await llm_service.rewrite_lyrics(
            profile_description=profile_description,
            title=req.title,
            artist=req.artist,
            lyrics_with_chords=lyrics,
            provider=req.provider,
            model=req.model,
            instruction=req.instruction,
            api_base=api_base,
            reasoning_effort=req.reasoning_effort,
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
    req: WorkshopLineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    song = get_user_song(db, current_user, req.song_id)

    api_base = _lookup_api_base(db, song.profile_id, req.provider, req.model)

    try:
        result = await llm_service.workshop_line(
            original_lyrics=song.original_lyrics,
            rewritten_lyrics=song.rewritten_lyrics,
            line_index=req.line_index,
            instruction=req.instruction,
            provider=req.provider,
            model=req.model,
            api_base=api_base,
            reasoning_effort=req.reasoning_effort,
        )
    except IndexError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from None

    return result


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    from ..models import Profile, SongRevision

    song = get_user_song(db, current_user, req.song_id)

    profile = db.query(Profile).filter(Profile.id == song.profile_id).first()
    profile_description = profile.description if profile else ""

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    api_base = _lookup_api_base(db, song.profile_id, req.provider, req.model)

    try:
        result = await llm_service.chat_edit_lyrics(
            song=song,
            profile_description=profile_description or "",
            messages=messages,
            provider=req.provider,
            model=req.model,
            api_base=api_base,
            reasoning_effort=req.reasoning_effort,
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
async def list_providers(
    current_user: User = Depends(get_current_user),
) -> list[dict[str, str | bool]]:
    return llm_service.get_configured_providers()


@router.get("/providers/{provider}/models")
async def list_provider_models(
    provider: str,
    api_base: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[str]:
    try:
        return await llm_service.get_models(provider, api_base=api_base)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from None
