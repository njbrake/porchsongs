from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Legacy columns kept for backward-compat with existing DBs
    location_type: Mapped[str] = mapped_column(String, default="suburb")
    location_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    occupation: Mapped[str | None] = mapped_column(Text, nullable=True)
    hobbies: Mapped[str | None] = mapped_column(Text, nullable=True)
    family_situation: Mapped[str | None] = mapped_column(Text, nullable=True)
    daily_routine: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_references: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class Song(Base):
    __tablename__ = "songs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    artist: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_lyrics: Mapped[str] = mapped_column(Text, nullable=False)
    rewritten_lyrics: Mapped[str] = mapped_column(Text, nullable=False)
    changes_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_provider: Mapped[str | None] = mapped_column(String, nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft")
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class SongRevision(Base):
    __tablename__ = "song_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    song_id: Mapped[int] = mapped_column(Integer, ForeignKey("songs.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    rewritten_lyrics: Mapped[str] = mapped_column(Text, nullable=False)
    changes_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    edit_type: Mapped[str] = mapped_column(String, default="full")  # "full" or "line"
    edit_context: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    song_id: Mapped[int] = mapped_column(Integer, ForeignKey("songs.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_note: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class ProfileModel(Base):
    __tablename__ = "profile_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    api_base: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class SubstitutionPattern(Base):
    __tablename__ = "substitution_patterns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id"), nullable=False)
    song_id: Mapped[int] = mapped_column(Integer, ForeignKey("songs.id"), nullable=False)
    original_term: Mapped[str] = mapped_column(Text, nullable=False)
    replacement_term: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
