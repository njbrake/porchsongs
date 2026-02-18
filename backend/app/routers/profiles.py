from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile, ProfileModel
from ..schemas import ProfileCreate, ProfileModelCreate, ProfileModelOut, ProfileOut, ProfileUpdate

router = APIRouter()


@router.get("/profiles", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db)) -> list[Any]:
    return db.query(Profile).order_by(Profile.created_at.desc()).all()


@router.post("/profiles", response_model=ProfileOut, status_code=201)
def create_profile(data: ProfileCreate, db: Session = Depends(get_db)) -> Profile:
    # If this profile is set as default, unset other defaults
    if data.is_default:
        db.query(Profile).filter(Profile.is_default.is_(True)).update({"is_default": False})

    # If no profiles exist, make this one the default
    if db.query(Profile).count() == 0:
        data.is_default = True

    profile = Profile(**data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: int, db: Session = Depends(get_db)) -> Profile:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/profiles/{profile_id}", response_model=ProfileOut)
def update_profile(profile_id: int, data: ProfileUpdate, db: Session = Depends(get_db)) -> Profile:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = data.model_dump(exclude_unset=True)

    # If setting as default, unset others
    if update_data.get("is_default"):
        db.query(Profile).filter(Profile.is_default.is_(True), Profile.id != profile_id).update(
            {"is_default": False}
        )

    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.query(ProfileModel).filter(ProfileModel.profile_id == profile_id).delete()
    db.delete(profile)
    db.commit()
    return {"ok": True}


@router.get("/profiles/{profile_id}/models", response_model=list[ProfileModelOut])
def list_profile_models(profile_id: int, db: Session = Depends(get_db)) -> list[Any]:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return (
        db.query(ProfileModel)
        .filter(ProfileModel.profile_id == profile_id)
        .order_by(ProfileModel.created_at.desc())
        .all()
    )


@router.post("/profiles/{profile_id}/models", response_model=ProfileModelOut, status_code=201)
def add_profile_model(
    profile_id: int, data: ProfileModelCreate, db: Session = Depends(get_db)
) -> ProfileModel:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    existing = (
        db.query(ProfileModel)
        .filter(
            ProfileModel.profile_id == profile_id,
            ProfileModel.provider == data.provider,
            ProfileModel.model == data.model,
        )
        .first()
    )
    if existing:
        existing.api_base = data.api_base
        db.commit()
        db.refresh(existing)
        return existing

    pm = ProfileModel(profile_id=profile_id, **data.model_dump())
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm


@router.delete("/profiles/{profile_id}/models/{model_id}")
def delete_profile_model(
    profile_id: int, model_id: int, db: Session = Depends(get_db)
) -> dict[str, bool]:
    pm = (
        db.query(ProfileModel)
        .filter(ProfileModel.id == model_id, ProfileModel.profile_id == profile_id)
        .first()
    )
    if not pm:
        raise HTTPException(status_code=404, detail="Saved model not found")
    db.delete(pm)
    db.commit()
    return {"ok": True}
