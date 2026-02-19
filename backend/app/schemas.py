from datetime import datetime

from pydantic import BaseModel


# --- Profiles ---
class ProfileCreate(BaseModel):
    name: str
    description: str | None = None
    is_default: bool = False


class ProfileUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_default: bool | None = None


class ProfileOut(BaseModel):
    id: int
    name: str
    description: str | None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Profile Models ---
class ProfileModelCreate(BaseModel):
    provider: str
    model: str
    api_base: str | None = None


class ProfileModelOut(BaseModel):
    id: int
    profile_id: int
    provider: str
    model: str
    api_base: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Provider Connections ---
class ProviderConnectionCreate(BaseModel):
    provider: str
    api_base: str | None = None


class ProviderConnectionOut(BaseModel):
    id: int
    profile_id: int
    provider: str
    api_base: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Rewrite ---
class RewriteRequest(BaseModel):
    profile_id: int
    title: str | None = None
    artist: str | None = None
    lyrics: str
    source_url: str | None = None
    instruction: str | None = None
    provider: str
    model: str
    reasoning_effort: str | None = None


class RewriteResponse(BaseModel):
    original_lyrics: str
    rewritten_lyrics: str
    changes_summary: str
    title: str | None = None
    artist: str | None = None


# --- Songs ---
class SongCreate(BaseModel):
    profile_id: int
    title: str | None = None
    artist: str | None = None
    source_url: str | None = None
    original_lyrics: str
    rewritten_lyrics: str
    changes_summary: str | None = None
    llm_provider: str | None = None
    llm_model: str | None = None
    folder: str | None = None


class SongOut(BaseModel):
    id: int
    profile_id: int
    title: str | None
    artist: str | None
    source_url: str | None
    original_lyrics: str
    rewritten_lyrics: str
    changes_summary: str | None
    llm_provider: str | None
    llm_model: str | None
    folder: str | None = None
    status: str
    current_version: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Song Revisions ---
class SongRevisionOut(BaseModel):
    id: int
    song_id: int
    version: int
    rewritten_lyrics: str
    changes_summary: str | None
    edit_type: str
    edit_context: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SongUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    rewritten_lyrics: str | None = None
    folder: str | None = None


# --- Song Status ---
class SongStatusUpdate(BaseModel):
    status: str  # "draft" or "completed"


# --- Workshop ---
class WorkshopLineRequest(BaseModel):
    song_id: int
    line_index: int  # index of the lyrics-only line to workshop
    instruction: str | None = None  # optional user instruction
    provider: str
    model: str
    reasoning_effort: str | None = None


class WorkshopAlternative(BaseModel):
    text: str
    reasoning: str


class WorkshopLineResponse(BaseModel):
    original_line: str
    current_line: str
    alternatives: list[WorkshopAlternative]


# --- Apply Edit ---
class ApplyEditRequest(BaseModel):
    song_id: int
    line_index: int  # lyrics-only line index
    new_line_text: str


class ApplyEditResponse(BaseModel):
    rewritten_lyrics: str
    version: int


# --- Chat ---
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatMessageCreate(BaseModel):
    role: str
    content: str
    is_note: bool = False


class ChatMessageOut(BaseModel):
    id: int
    song_id: int
    role: str
    content: str
    is_note: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    song_id: int
    messages: list[ChatMessage]
    provider: str
    model: str
    reasoning_effort: str | None = None


class ChatResponse(BaseModel):
    rewritten_lyrics: str
    assistant_message: str
    changes_summary: str
    version: int
