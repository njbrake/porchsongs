import contextlib
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ChatMessage, ProfileModel, Song, SongRevision, SubstitutionPattern
from ..schemas import (
    ApplyEditRequest,
    ApplyEditResponse,
    ChatMessageCreate,
    ChatMessageOut,
    SongCreate,
    SongOut,
    SongRevisionOut,
    SongStatusUpdate,
    SongUpdate,
    SubstitutionPatternOut,
)
from ..services.chord_parser import replace_line_with_chords

router = APIRouter()


@router.get("/songs", response_model=list[SongOut])
def list_songs(profile_id: int | None = None, db: Session = Depends(get_db)) -> list[Any]:
    query = db.query(Song)
    if profile_id is not None:
        query = query.filter(Song.profile_id == profile_id)
    return query.order_by(Song.created_at.desc()).all()


@router.get("/songs/{song_id}", response_model=SongOut)
def get_song(song_id: int, db: Session = Depends(get_db)) -> Song:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@router.get("/songs/{song_id}/pdf")
def download_song_pdf(song_id: int, db: Session = Depends(get_db)) -> Response:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    from ..services.pdf_service import generate_song_pdf

    pdf_bytes = generate_song_pdf(song.title or "Untitled", song.artist, song.rewritten_lyrics)

    title = song.title or "Untitled"
    artist = song.artist or "Unknown"
    filename = f"{title} - {artist}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/songs", response_model=SongOut, status_code=201)
def create_song(data: SongCreate, db: Session = Depends(get_db)) -> Song:
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


@router.put("/songs/{song_id}", response_model=SongOut)
def update_song(song_id: int, data: SongUpdate, db: Session = Depends(get_db)) -> Song:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    if data.title is not None:
        song.title = data.title
    if data.artist is not None:
        song.artist = data.artist
    db.commit()
    db.refresh(song)
    return song


@router.delete("/songs/{song_id}")
def delete_song(song_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    # Delete related revisions, patterns, and chat messages
    db.query(SongRevision).filter(SongRevision.song_id == song_id).delete()
    db.query(SubstitutionPattern).filter(SubstitutionPattern.song_id == song_id).delete()
    db.query(ChatMessage).filter(ChatMessage.song_id == song_id).delete()
    db.delete(song)
    db.commit()
    return {"ok": True}


@router.get("/songs/{song_id}/revisions", response_model=list[SongRevisionOut])
def list_revisions(song_id: int, db: Session = Depends(get_db)) -> list[Any]:
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


@router.get("/songs/{song_id}/messages", response_model=list[ChatMessageOut])
def list_messages(song_id: int, db: Session = Depends(get_db)) -> list[Any]:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.song_id == song_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.post("/songs/{song_id}/messages", response_model=list[ChatMessageOut], status_code=201)
def save_messages(
    song_id: int, messages: list[ChatMessageCreate], db: Session = Depends(get_db)
) -> list[Any]:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    rows = []
    for msg in messages:
        row = ChatMessage(song_id=song_id, role=msg.role, content=msg.content, is_note=msg.is_note)
        db.add(row)
        rows.append(row)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


@router.put("/songs/{song_id}/status", response_model=SongOut)
async def update_song_status(
    song_id: int,
    data: SongStatusUpdate,
    db: Session = Depends(get_db),
) -> Song:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    if data.status not in ("draft", "completed"):
        raise HTTPException(status_code=400, detail="Status must be 'draft' or 'completed'")

    song.status = data.status
    db.commit()
    db.refresh(song)

    # If marked as completed, extract substitution patterns using song's stored LLM settings
    if data.status == "completed" and song.llm_provider and song.llm_model:
        from ..services import llm_service

        # Look up api_base from the saved ProfileModel
        pm = (
            db.query(ProfileModel)
            .filter(
                ProfileModel.profile_id == song.profile_id,
                ProfileModel.provider == song.llm_provider,
                ProfileModel.model == song.llm_model,
            )
            .first()
        )
        api_base = pm.api_base if pm else None

        with contextlib.suppress(Exception):
            await llm_service.extract_patterns(
                song,
                db,
                song.llm_provider,
                song.llm_model,
                api_base=api_base,
            )

    return song


@router.post("/apply-edit", response_model=ApplyEditResponse)
def apply_edit(data: ApplyEditRequest, db: Session = Depends(get_db)) -> dict[str, str | int]:
    song = db.query(Song).filter(Song.id == data.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Replace the line in the full chord text
    try:
        new_full_text = replace_line_with_chords(
            song.rewritten_lyrics, data.line_index, data.new_line_text
        )
    except (IndexError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

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
        edit_context=json.dumps(
            {
                "line_index": data.line_index,
                "new_line_text": data.new_line_text,
            }
        ),
    )
    db.add(revision)
    db.commit()
    db.refresh(song)

    return {"rewritten_lyrics": song.rewritten_lyrics, "version": new_version}


@router.get("/patterns", response_model=list[SubstitutionPatternOut])
def list_patterns(profile_id: int | None = None, db: Session = Depends(get_db)) -> list[Any]:
    query = db.query(SubstitutionPattern)
    if profile_id is not None:
        query = query.filter(SubstitutionPattern.profile_id == profile_id)
    return query.order_by(SubstitutionPattern.created_at.desc()).all()
