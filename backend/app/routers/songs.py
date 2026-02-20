import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..auth.scoping import get_user_song
from ..database import get_db
from ..models import (
    ChatMessage,
    Song,
    SongRevision,
    User,
)
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
)
from ..services.chord_parser import replace_line_with_chords

router = APIRouter()


@router.get("/songs", response_model=list[SongOut])
async def list_songs(
    profile_id: int | None = None,
    search: str | None = None,
    folder: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Any]:
    query = db.query(Song).filter(Song.user_id == current_user.id)
    if profile_id is not None:
        query = query.filter(Song.profile_id == profile_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter((Song.title.ilike(pattern)) | (Song.artist.ilike(pattern)))
    if folder is not None:
        if folder == "__unfiled__":
            query = query.filter(Song.folder.is_(None))
        else:
            query = query.filter(Song.folder == folder)
    return query.order_by(Song.created_at.desc()).all()


@router.get("/songs/folders", response_model=list[str])
async def list_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[str]:
    rows = (
        db.query(Song.folder)
        .filter(Song.user_id == current_user.id, Song.folder.isnot(None), Song.folder != "")
        .distinct()
        .all()
    )
    return sorted(row[0] for row in rows)


@router.get("/songs/{song_id}", response_model=SongOut)
async def get_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Song:
    return get_user_song(db, current_user, song_id)


@router.get("/songs/{song_id}/pdf")
async def download_song_pdf(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    song = get_user_song(db, current_user, song_id)

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
async def create_song(
    data: SongCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Song:
    song = Song(**data.model_dump(), user_id=current_user.id, status="draft", current_version=1)
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
async def update_song(
    song_id: int,
    data: SongUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Song:
    song = get_user_song(db, current_user, song_id)
    if data.title is not None:
        song.title = data.title
    if data.artist is not None:
        song.artist = data.artist
    if data.rewritten_lyrics is not None:
        song.rewritten_lyrics = data.rewritten_lyrics
    if data.folder is not None:
        song.folder = data.folder if data.folder != "" else None
    db.commit()
    db.refresh(song)
    return song


@router.delete("/songs/{song_id}")
async def delete_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    song = get_user_song(db, current_user, song_id)
    # Delete related revisions and chat messages
    db.query(SongRevision).filter(SongRevision.song_id == song.id).delete()
    db.query(ChatMessage).filter(ChatMessage.song_id == song.id).delete()
    db.delete(song)
    db.commit()
    return {"ok": True}


@router.get("/songs/{song_id}/revisions", response_model=list[SongRevisionOut])
async def list_revisions(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Any]:
    get_user_song(db, current_user, song_id)
    revisions = (
        db.query(SongRevision)
        .filter(SongRevision.song_id == song_id)
        .order_by(SongRevision.version.asc())
        .all()
    )
    return revisions


@router.get("/songs/{song_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Any]:
    get_user_song(db, current_user, song_id)
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.song_id == song_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.post("/songs/{song_id}/messages", response_model=list[ChatMessageOut], status_code=201)
async def save_messages(
    song_id: int,
    messages: list[ChatMessageCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Any]:
    get_user_song(db, current_user, song_id)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Song:
    song = get_user_song(db, current_user, song_id)

    if data.status not in ("draft", "completed"):
        raise HTTPException(status_code=400, detail="Status must be 'draft' or 'completed'")

    song.status = data.status
    db.commit()
    db.refresh(song)

    return song


@router.post("/apply-edit", response_model=ApplyEditResponse)
async def apply_edit(
    data: ApplyEditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str | int]:
    song = get_user_song(db, current_user, data.song_id)

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
    summary = f"Line {data.line_index + 1} edited"
    revision = SongRevision(
        song_id=song.id,
        version=new_version,
        rewritten_lyrics=new_full_text,
        changes_summary=summary,
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
