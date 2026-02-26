from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile, User

LOCAL_EMAIL = "local@porchsongs.local"


def _get_or_create_local_user(db: Session) -> User:
    """Return the single local user, creating it on first access."""
    user = db.query(User).filter(User.email == LOCAL_EMAIL).first()
    if user:
        return user
    user = User(
        email=LOCAL_EMAIL,
        name="Local User",
        role="admin",
        is_active=True,
        created_at=datetime.now(UTC),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        user = db.query(User).filter(User.email == LOCAL_EMAIL).first()
        if user:
            return user
        raise
    db.refresh(user)
    # Create a default profile for the new user
    profile = Profile(
        user_id=user.id,
        is_default=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(profile)
    db.commit()
    return user


def get_current_user(
    db: Session = Depends(get_db),
) -> User:
    """Return the local default user.

    In OSS mode there is no authentication — every request is served by the
    single local user.  When a premium plugin is loaded it overrides this
    dependency with its own JWT-backed implementation.
    """
    return _get_or_create_local_user(db)
