import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Song, SongRevision, SubstitutionPattern
from ..schemas import (
    ApplyEditRequest,
    ApplyEditResponse,
    SongCreate,
    SongOut,
    SongRevisionOut,
    SongStatusUpdate,
    SubstitutionPatternOut,
)
from ..services.chord_parser import replace_line_with_chords

router = APIRouter()


@router.get("/songs", response_model=list[SongOut])
def list_songs(profile_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Song)
    if profile_id is not None:
        query = query.filter(Song.profile_id == profile_id)
    return query.order_by(Song.created_at.desc()).all()


@router.get("/songs/{song_id}", response_model=SongOut)
def get_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@router.post("/songs", response_model=SongOut, status_code=201)
def create_song(data: SongCreate, db: Session = Depends(get_db)):
    song = Song(**data.model_dump(), status="draft", current_version=1)
    db.add(song)
    db.commit()
    db.refresh(song)

    # Create initial revision (version 1)
    revision = SongRevision(
        song_id=song.id,
        version=1,
        rewritten_lyrics=song.rewritten_lyrics,
        changes_summary=song.changes_summary,
        edit_type="full",
    )
    db.add(revision)
    db.commit()

    return song


@router.delete("/songs/{song_id}")
def delete_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    # Delete related revisions and patterns
    db.query(SongRevision).filter(SongRevision.song_id == song_id).delete()
    db.query(SubstitutionPattern).filter(SubstitutionPattern.song_id == song_id).delete()
    db.delete(song)
    db.commit()
    return {"ok": True}


@router.get("/songs/{song_id}/revisions", response_model=list[SongRevisionOut])
def list_revisions(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    revisions = (
        db.query(SongRevision)
        .filter(SongRevision.song_id == song_id)
        .order_by(SongRevision.version.asc())
        .all()
    )
    return revisions


@router.put("/songs/{song_id}/status", response_model=SongOut)
async def update_song_status(
    song_id: int,
    data: SongStatusUpdate,
    db: Session = Depends(get_db),
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    if data.status not in ("draft", "completed"):
        raise HTTPException(status_code=400, detail="Status must be 'draft' or 'completed'")

    song.status = data.status
    db.commit()
    db.refresh(song)

    # If marked as completed and API key provided, extract substitution patterns
    if data.status == "completed" and data.api_key:
        from ..services import llm_service

        provider = data.provider or song.llm_provider or "openai"
        model = data.model or song.llm_model or "gpt-4o-mini"
        try:
            await llm_service.extract_patterns_with_key(
                song, db, provider, model, data.api_key, api_base=data.api_base,
            )
        except Exception:
            # Pattern extraction is best-effort; don't fail the status update
            pass

    return song


@router.post("/apply-edit", response_model=ApplyEditResponse)
def apply_edit(data: ApplyEditRequest, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == data.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Replace the line in the full chord text
    try:
        new_full_text = replace_line_with_chords(
            song.rewritten_lyrics, data.line_index, data.new_line_text
        )
    except (IndexError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Bump version
    new_version = song.current_version + 1
    song.rewritten_lyrics = new_full_text
    song.current_version = new_version

    # Save revision
    revision = SongRevision(
        song_id=song.id,
        version=new_version,
        rewritten_lyrics=new_full_text,
        changes_summary=f"Line {data.line_index + 1} edited",
        edit_type="line",
        edit_context=json.dumps({
            "line_index": data.line_index,
            "new_line_text": data.new_line_text,
        }),
    )
    db.add(revision)
    db.commit()
    db.refresh(song)

    return {"rewritten_lyrics": song.rewritten_lyrics, "version": new_version}


@router.get("/patterns", response_model=list[SubstitutionPatternOut])
def list_patterns(profile_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(SubstitutionPattern)
    if profile_id is not None:
        query = query.filter(SubstitutionPattern.profile_id == profile_id)
    return query.order_by(SubstitutionPattern.created_at.desc()).all()
