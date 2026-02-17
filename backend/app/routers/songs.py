from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Song
from ..schemas import SongCreate, SongOut

router = APIRouter()


@router.get("/songs", response_model=list[SongOut])
def list_songs(profile_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Song)
    if profile_id is not None:
        query = query.filter(Song.profile_id == profile_id)
    return query.order_by(Song.created_at.desc()).all()


@router.post("/songs", response_model=SongOut, status_code=201)
def create_song(data: SongCreate, db: Session = Depends(get_db)):
    song = Song(**data.model_dump())
    db.add(song)
    db.commit()
    db.refresh(song)
    return song


@router.delete("/songs/{song_id}")
def delete_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    db.delete(song)
    db.commit()
    return {"ok": True}
