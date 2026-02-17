from datetime import datetime

from pydantic import BaseModel


# --- Profiles ---
class ProfileCreate(BaseModel):
    name: str
    location_type: str = "suburb"
    location_description: str | None = None
    occupation: str | None = None
    hobbies: str | None = None
    family_situation: str | None = None
    daily_routine: str | None = None
    custom_references: str | None = None
    is_default: bool = False


class ProfileUpdate(BaseModel):
    name: str | None = None
    location_type: str | None = None
    location_description: str | None = None
    occupation: str | None = None
    hobbies: str | None = None
    family_situation: str | None = None
    daily_routine: str | None = None
    custom_references: str | None = None
    is_default: bool | None = None


class ProfileOut(BaseModel):
    id: int
    name: str
    location_type: str
    location_description: str | None
    occupation: str | None
    hobbies: str | None
    family_situation: str | None
    daily_routine: str | None
    custom_references: str | None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Tab Fetch ---
class FetchTabRequest(BaseModel):
    url: str


class FetchTabResponse(BaseModel):
    title: str
    artist: str
    lyrics_with_chords: str
    chord_format: str  # "above-line" or "inline"


# --- Rewrite ---
class RewriteRequest(BaseModel):
    profile_id: int
    title: str | None = None
    artist: str | None = None
    lyrics: str
    source_url: str | None = None
    provider: str
    model: str
    api_key: str


class RewriteResponse(BaseModel):
    original_lyrics: str
    rewritten_lyrics: str
    changes_summary: str


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


# --- Song Status ---
class SongStatusUpdate(BaseModel):
    status: str  # "draft" or "completed"
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None


# --- Workshop ---
class WorkshopLineRequest(BaseModel):
    song_id: int
    line_index: int  # index of the lyrics-only line to workshop
    instruction: str | None = None  # optional user instruction
    provider: str
    model: str
    api_key: str


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


# --- Substitution Patterns ---
class SubstitutionPatternOut(BaseModel):
    id: int
    profile_id: int
    song_id: int
    original_term: str
    replacement_term: str
    category: str | None
    reasoning: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Providers ---
class ProviderInfo(BaseModel):
    name: str
    models: list[str]
