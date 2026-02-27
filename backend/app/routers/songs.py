import json

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..auth.scoping import get_user_profile, get_user_song
from ..database import get_db
from ..models import (
    ChatMessage,
    Song,
    SongRevision,
    User,
)
from ..schemas import (
    ChatMessageCreate,
    ChatMessageOut,
    FolderRename,
    OkResponse,
    SongCreate,
    SongOut,
    SongRevisionOut,
    SongStatusUpdate,
    SongUpdate,
)
from ..services.pdf_service import generate_song_pdf

router = APIRouter(tags=["songs"])


@router.get("/songs", response_model=list[SongOut])
async def list_songs(
    profile_id: int | None = None,
    search: str | None = None,
    folder: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Song]:
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


@router.put("/songs/folders/{folder_name}", response_model=OkResponse)
async def rename_folder(
    folder_name: str,
    data: FolderRename,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OkResponse:
    db.query(Song).filter(Song.user_id == current_user.id, Song.folder == folder_name).update(
        {Song.folder: data.name}
    )
    db.commit()
    return OkResponse(ok=True)


@router.delete("/songs/folders/{folder_name}", response_model=OkResponse)
async def delete_folder(
    folder_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OkResponse:
    db.query(Song).filter(Song.user_id == current_user.id, Song.folder == folder_name).update(
        {Song.folder: None}
    )
    db.commit()
    return OkResponse(ok=True)


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
    pdf_bytes = generate_song_pdf(song.title or "Untitled", song.artist, song.rewritten_content)

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
    # Verify the profile belongs to this user
    get_user_profile(db, current_user, data.profile_id)

    song = Song(**data.model_dump(), user_id=current_user.id, status="draft", current_version=1)
    db.add(song)
    db.commit()
    db.refresh(song)

    # Create initial revision (version 1)
    revision = SongRevision(
        song_id=song.id,
        version=1,
        rewritten_content=song.rewritten_content,
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
    if data.original_content is not None:
        song.original_content = data.original_content
    if data.rewritten_content is not None:
        song.rewritten_content = data.rewritten_content
    if data.font_size is not None:
        song.font_size = data.font_size if data.font_size > 0 else None
    if data.folder is not None:
        song.folder = data.folder if data.folder != "" else None
    db.commit()
    db.refresh(song)
    return song


@router.delete("/songs/{song_id}", response_model=OkResponse)
async def delete_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OkResponse:
    song = get_user_song(db, current_user, song_id)
    db.delete(song)
    db.commit()
    return OkResponse(ok=True)


@router.get("/songs/{song_id}/revisions", response_model=list[SongRevisionOut])
async def list_revisions(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SongRevision]:
    get_user_song(db, current_user, song_id)
    revisions = (
        db.query(SongRevision)
        .filter(SongRevision.song_id == song_id)
        .order_by(SongRevision.version.asc())
        .all()
    )
    return revisions


def _display_content(raw: str) -> str:
    """Convert persisted content to display-friendly text.

    Multimodal content is stored as a JSON array; extract the text portions
    for display and use ``[Image]`` as a placeholder for image-only messages.
    """
    if raw.startswith("["):
        try:
            parts = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return raw
        text = " ".join(str(p["text"]) for p in parts if p.get("type") == "text")
        if not text and any(p.get("type") == "image_url" for p in parts):
            return "[Image]"
        return text or raw
    return raw


@router.get("/songs/{song_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatMessageOut]:
    get_user_song(db, current_user, song_id)
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.song_id == song_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        ChatMessageOut(
            id=row.id,
            song_id=row.song_id,
            role=row.role,
            content=_display_content(row.content),
            is_note=row.is_note,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/songs/{song_id}/messages", response_model=list[ChatMessageOut], status_code=201)
async def save_messages(
    song_id: int,
    messages: list[ChatMessageCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatMessage]:
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
    song.status = data.status
    db.commit()
    db.refresh(song)

    return song
