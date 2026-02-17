from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..schemas import (
    FetchTabRequest,
    FetchTabResponse,
    ProviderInfo,
    RewriteRequest,
    RewriteResponse,
)
from ..services import llm_service, tab_fetcher
from ..services.chord_parser import inline_to_above_line

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

    try:
        result = await llm_service.rewrite_lyrics(
            profile=profile_dict,
            title=req.title,
            artist=req.artist,
            lyrics_with_chords=lyrics,
            provider=req.provider,
            model=req.model,
            api_key=req.api_key,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    return result


@router.get("/providers", response_model=list[ProviderInfo])
def list_providers():
    return llm_service.get_providers()
