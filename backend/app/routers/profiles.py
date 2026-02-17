from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..schemas import ProfileCreate, ProfileOut, ProfileUpdate

router = APIRouter()


@router.get("/profiles", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    return db.query(Profile).order_by(Profile.created_at.desc()).all()


@router.post("/profiles", response_model=ProfileOut, status_code=201)
def create_profile(data: ProfileCreate, db: Session = Depends(get_db)):
    # If this profile is set as default, unset other defaults
    if data.is_default:
        db.query(Profile).filter(Profile.is_default.is_(True)).update(
            {"is_default": False}
        )

    # If no profiles exist, make this one the default
    if db.query(Profile).count() == 0:
        data.is_default = True

    profile = Profile(**data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/profiles/{profile_id}", response_model=ProfileOut)
def update_profile(
    profile_id: int, data: ProfileUpdate, db: Session = Depends(get_db)
):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = data.model_dump(exclude_unset=True)

    # If setting as default, unset others
    if update_data.get("is_default"):
        db.query(Profile).filter(
            Profile.is_default.is_(True), Profile.id != profile_id
        ).update({"is_default": False})

    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()
    return {"ok": True}
