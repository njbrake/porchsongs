from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile, Song
from ..schemas import (
    ChatRequest,
    ChatResponse,
    FetchTabRequest,
    FetchTabResponse,
    RewriteRequest,
    RewriteResponse,
    VerifyConnectionRequest,
    VerifyConnectionResponse,
    WorkshopLineRequest,
    WorkshopLineResponse,
)
from ..services import llm_service, tab_fetcher
from ..services.chord_parser import extract_lyrics_only, inline_to_above_line

router = APIRouter()


@router.post("/fetch-tab", response_model=FetchTabResponse)
def fetch_tab(req: FetchTabRequest):
    try:
        result = tab_fetcher.fetch_tab(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch tab: {e}")
    return result


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(req: RewriteRequest, db: Session = Depends(get_db)):
    # Load profile
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile_dict = {
        "location_type": profile.location_type,
        "location_description": profile.location_description,
        "occupation": profile.occupation,
        "hobbies": profile.hobbies,
        "family_situation": profile.family_situation,
        "daily_routine": profile.daily_routine,
        "custom_references": profile.custom_references,
    }

    # Normalize chord format if inline
    lyrics = req.lyrics
    if "[" in lyrics and "]" in lyrics:
        lyrics = inline_to_above_line(lyrics)

    # Load substitution patterns for this profile
    from ..models import SubstitutionPattern

    patterns = (
        db.query(SubstitutionPattern)
        .filter(SubstitutionPattern.profile_id == req.profile_id)
        .all()
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
            "original_lyrics": extract_lyrics_only(recent_completed.original_lyrics),
            "rewritten_lyrics": extract_lyrics_only(recent_completed.rewritten_lyrics),
        }

    try:
        result = await llm_service.rewrite_lyrics(
            profile=profile_dict,
            title=req.title,
            artist=req.artist,
            lyrics_with_chords=lyrics,
            provider=req.provider,
            model=req.model,
            api_key=req.api_key,
            patterns=pattern_list,
            example=example,
            instruction=req.instruction,
            api_base=req.api_base,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    return result


@router.post("/workshop-line", response_model=WorkshopLineResponse)
async def workshop_line(req: WorkshopLineRequest, db: Session = Depends(get_db)):
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
            api_key=req.api_key,
            api_base=req.api_base,
        )
    except IndexError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    return result


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    from ..models import SongRevision

    song = db.query(Song).filter(Song.id == req.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    profile = db.query(Profile).filter(Profile.id == song.profile_id).first()
    profile_dict = {
        "location_type": profile.location_type,
        "location_description": profile.location_description,
        "occupation": profile.occupation,
        "hobbies": profile.hobbies,
        "family_situation": profile.family_situation,
        "daily_routine": profile.daily_routine,
        "custom_references": profile.custom_references,
    } if profile else {}

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        result = await llm_service.chat_edit_lyrics(
            song=song,
            profile=profile_dict,
            messages=messages,
            provider=req.provider,
            model=req.model,
            api_key=req.api_key,
            api_base=req.api_base,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

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
    db.commit()

    return ChatResponse(
        rewritten_lyrics=result["rewritten_lyrics"],
        assistant_message=result["assistant_message"],
        changes_summary=result["changes_summary"],
        version=song.current_version,
    )


@router.get("/providers")
def list_providers():
    return llm_service.get_providers()


@router.post("/verify-connection", response_model=VerifyConnectionResponse)
def verify_connection(req: VerifyConnectionRequest):
    try:
        models = llm_service.get_models(req.provider, req.api_key, api_base=req.api_base)
        return VerifyConnectionResponse(ok=True, models=models)
    except Exception as e:
        return VerifyConnectionResponse(ok=False, error=str(e))
