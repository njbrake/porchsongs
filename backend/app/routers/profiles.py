from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..auth.scoping import get_user_profile
from ..database import get_db
from ..models import Profile, ProfileModel, ProviderConnection, User
from ..schemas import (
    ProfileCreate,
    ProfileModelCreate,
    ProfileModelOut,
    ProfileOut,
    ProfileUpdate,
    ProviderConnectionCreate,
    ProviderConnectionOut,
)

router = APIRouter()


@router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Profile]:
    return (
        db.query(Profile)
        .filter(Profile.user_id == current_user.id)
        .order_by(Profile.created_at.desc())
        .all()
    )


@router.post("/profiles", response_model=ProfileOut, status_code=201)
async def create_profile(
    data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Profile:
    # If this profile is set as default, unset other defaults for this user
    if data.is_default:
        db.query(Profile).filter(
            Profile.user_id == current_user.id, Profile.is_default.is_(True)
        ).update({"is_default": False})

    # If no profiles exist for this user, make this one the default
    if not db.query(Profile).filter(Profile.user_id == current_user.id).first():
        data.is_default = True

    profile = Profile(**data.model_dump(), user_id=current_user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles/{profile_id}", response_model=ProfileOut)
async def get_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Profile:
    return get_user_profile(db, current_user, profile_id)


@router.put("/profiles/{profile_id}", response_model=ProfileOut)
async def update_profile(
    profile_id: int,
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Profile:
    profile = get_user_profile(db, current_user, profile_id)

    update_data = data.model_dump(exclude_unset=True)

    # If setting as default, unset others for this user
    if update_data.get("is_default"):
        db.query(Profile).filter(
            Profile.user_id == current_user.id,
            Profile.is_default.is_(True),
            Profile.id != profile_id,
        ).update({"is_default": False})

    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/profiles/{profile_id}")
async def delete_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    from ..models import Song

    profile = get_user_profile(db, current_user, profile_id)

    # Prevent deleting a profile that still has songs
    song_count = db.query(Song).filter(Song.profile_id == profile.id).count()
    if song_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete profile with {song_count} song(s). "
            "Move or delete the songs first.",
        )

    db.query(ProfileModel).filter(ProfileModel.profile_id == profile.id).delete()
    db.query(ProviderConnection).filter(ProviderConnection.profile_id == profile.id).delete()
    db.delete(profile)
    db.commit()
    return {"ok": True}


@router.get("/profiles/{profile_id}/models", response_model=list[ProfileModelOut])
async def list_profile_models(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProfileModel]:
    get_user_profile(db, current_user, profile_id)
    return (
        db.query(ProfileModel)
        .filter(ProfileModel.profile_id == profile_id)
        .order_by(ProfileModel.created_at.desc())
        .all()
    )


@router.post("/profiles/{profile_id}/models", response_model=ProfileModelOut, status_code=201)
async def add_profile_model(
    profile_id: int,
    data: ProfileModelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileModel:
    get_user_profile(db, current_user, profile_id)

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
async def delete_profile_model(
    profile_id: int,
    model_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    get_user_profile(db, current_user, profile_id)
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


# --- Provider Connections ---


@router.get("/profiles/{profile_id}/connections", response_model=list[ProviderConnectionOut])
async def list_connections(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProviderConnection]:
    get_user_profile(db, current_user, profile_id)
    return (
        db.query(ProviderConnection)
        .filter(ProviderConnection.profile_id == profile_id)
        .order_by(ProviderConnection.created_at.desc())
        .all()
    )


@router.post(
    "/profiles/{profile_id}/connections", response_model=ProviderConnectionOut, status_code=201
)
async def add_connection(
    profile_id: int,
    data: ProviderConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProviderConnection:
    get_user_profile(db, current_user, profile_id)

    existing = (
        db.query(ProviderConnection)
        .filter(
            ProviderConnection.profile_id == profile_id,
            ProviderConnection.provider == data.provider,
        )
        .first()
    )
    if existing:
        existing.api_base = data.api_base
        db.commit()
        db.refresh(existing)
        return existing

    conn = ProviderConnection(profile_id=profile_id, **data.model_dump())
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.delete("/profiles/{profile_id}/connections/{connection_id}")
async def delete_connection(
    profile_id: int,
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    get_user_profile(db, current_user, profile_id)
    conn = (
        db.query(ProviderConnection)
        .filter(ProviderConnection.id == connection_id, ProviderConnection.profile_id == profile_id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    # Cascade-delete all ProfileModel rows for this provider
    db.query(ProfileModel).filter(
        ProfileModel.profile_id == profile_id,
        ProfileModel.provider == conn.provider,
    ).delete()
    db.delete(conn)
    db.commit()
    return {"ok": True}
