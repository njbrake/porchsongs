import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..auth.scoping import get_user_profile, get_user_song
from ..database import get_db
from ..models import ChatMessage as ChatMessageModel
from ..models import ProfileModel, ProviderConnection, Song, SongRevision, User
from ..schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ParseRequest,
    ParseResponse,
)
from ..services import llm_service

router = APIRouter()
logger = logging.getLogger(__name__)

T = TypeVar("T")


async def _cancellable(request: Request, coro: asyncio.Future[T]) -> T:
    """Run *coro* but cancel it if the client disconnects."""
    task = asyncio.ensure_future(coro)

    async def _watch_disconnect() -> None:
        while not task.done():
            if await request.is_disconnected():
                task.cancel()
                return
            await asyncio.sleep(0.5)

    watcher = asyncio.ensure_future(_watch_disconnect())
    try:
        return await task
    except asyncio.CancelledError:
        raise HTTPException(status_code=499, detail="Client disconnected") from None
    finally:
        watcher.cancel()


def _lookup_api_base(
    db: Session, profile_id: int | None, provider: str | None, model: str | None
) -> str | None:
    """Look up api_base: prefer ProviderConnection, fall back to ProfileModel."""
    if not profile_id or not provider:
        return None
    conn = (
        db.query(ProviderConnection)
        .filter(
            ProviderConnection.profile_id == profile_id,
            ProviderConnection.provider == provider,
        )
        .first()
    )
    if conn and conn.api_base:
        return conn.api_base
    # Backward compat: check ProfileModel
    if model:
        pm = (
            db.query(ProfileModel)
            .filter(
                ProfileModel.profile_id == profile_id,
                ProfileModel.provider == provider,
                ProfileModel.model == model,
            )
            .first()
        )
        if pm and pm.api_base:
            return pm.api_base
    return None


@router.post("/parse", response_model=ParseResponse)
async def parse(
    req: ParseRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    get_user_profile(db, current_user, req.profile_id)
    api_base = _lookup_api_base(db, req.profile_id, req.provider, req.model)

    try:
        result = await _cancellable(
            request,
            llm_service.parse_content(
                content=req.content,
                provider=req.provider,
                model=req.model,
                api_base=api_base,
                reasoning_effort=req.reasoning_effort,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from None

    return result


@router.post("/parse/stream")
async def parse_stream(
    req: ParseRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    get_user_profile(db, current_user, req.profile_id)
    api_base = _lookup_api_base(db, req.profile_id, req.provider, req.model)

    async def event_generator() -> AsyncIterator[str]:
        accumulated = ""
        try:
            stream = llm_service.parse_content_stream(
                content=req.content,
                provider=req.provider,
                model=req.model,
                api_base=api_base,
                reasoning_effort=req.reasoning_effort,
            )
            async for token in stream:
                if await request.is_disconnected():
                    return
                accumulated += token
                yield f"event: token\ndata: {json.dumps(token)}\n\n"
        except Exception:
            logger.exception("Parse stream LLM error")
            yield f"event: error\ndata: {json.dumps({'detail': 'LLM streaming error'})}\n\n"
            return

        # Parse the accumulated response
        parsed = llm_service._parse_clean_response(accumulated, req.content)
        done_data = {
            "original_content": parsed["original"],
            "title": parsed["title"],
            "artist": parsed["artist"],
        }
        yield f"event: done\ndata: {json.dumps(done_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _load_chat_messages(
    db: Session,
    song_id: int,
    req_messages: list[ChatMessage],
) -> list[dict[str, str]]:
    """Load persisted chat history and append new request messages."""
    history_rows = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.song_id == song_id, ChatMessageModel.is_note.is_(False))
        .order_by(ChatMessageModel.created_at)
        .all()
    )
    history: list[dict[str, str]] = [
        {"role": row.role, "content": row.content} for row in history_rows
    ]
    return history + [{"role": m.role, "content": m.content} for m in req_messages]


def _persist_chat_result(
    db: Session,
    song: Song,
    rewritten_content: str | None,
    changes_summary: str,
    assistant_content: str,
    req_messages: list[ChatMessage],
) -> None:
    """Update song, create revision, and save chat messages (does not commit)."""
    if rewritten_content is not None:
        song.rewritten_content = rewritten_content
        song.changes_summary = changes_summary
        song.current_version += 1

        db.add(
            SongRevision(
                song_id=song.id,
                version=song.current_version,
                rewritten_content=rewritten_content,
                changes_summary=changes_summary,
                edit_type="chat",
            )
        )

    last_user_msg = req_messages[-1] if req_messages else None
    if last_user_msg and last_user_msg.role == "user":
        db.add(
            ChatMessageModel(
                song_id=song.id, role="user", content=last_user_msg.content, is_note=False
            )
        )
    db.add(
        ChatMessageModel(
            song_id=song.id, role="assistant", content=assistant_content, is_note=False
        )
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    song = get_user_song(db, current_user, req.song_id)
    messages = _load_chat_messages(db, song.id, req.messages)
    api_base = _lookup_api_base(db, song.profile_id, req.provider, req.model)

    try:
        result = await _cancellable(
            request,
            llm_service.chat_edit_content(
                song=song,
                messages=messages,
                provider=req.provider,
                model=req.model,
                api_base=api_base,
                reasoning_effort=req.reasoning_effort,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from None

    _persist_chat_result(
        db,
        song,
        rewritten_content=result["rewritten_content"],
        changes_summary=result["changes_summary"],
        assistant_content=result["assistant_message"],
        req_messages=req.messages,
    )
    db.commit()

    return ChatResponse(
        rewritten_content=result["rewritten_content"],
        assistant_message=result["assistant_message"],
        changes_summary=result["changes_summary"],
        version=song.current_version,
    )


@router.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    song = get_user_song(db, current_user, req.song_id)
    messages = _load_chat_messages(db, song.id, req.messages)
    api_base = _lookup_api_base(db, song.profile_id, req.provider, req.model)

    async def event_generator() -> AsyncIterator[str]:
        accumulated = ""
        try:
            stream = llm_service.chat_edit_content_stream(
                song=song,
                messages=messages,
                provider=req.provider,
                model=req.model,
                api_base=api_base,
                reasoning_effort=req.reasoning_effort,
            )
            async for token in stream:
                if await request.is_disconnected():
                    return
                accumulated += token
                yield f"event: token\ndata: {json.dumps(token)}\n\n"
        except Exception:
            logger.exception("Chat stream LLM error")
            yield f"event: error\ndata: {json.dumps({'detail': 'LLM streaming error'})}\n\n"
            return

        # Parse the accumulated response
        parsed = llm_service._parse_chat_response(accumulated)
        changes_summary = parsed["explanation"] or "Chat edit applied."

        # Persist to DB (wrapped so a DB error doesn't lose the result)
        try:
            _persist_chat_result(
                db,
                song,
                rewritten_content=parsed["content"],
                changes_summary=changes_summary,
                assistant_content=accumulated,
                req_messages=req.messages,
            )
            db.commit()
        except Exception:
            logger.exception("Chat stream DB persist error")
            db.rollback()

        # Send final result
        done_data = {
            "rewritten_content": parsed["content"],
            "assistant_message": accumulated,
            "changes_summary": changes_summary,
            "version": song.current_version,
        }
        yield f"event: done\ndata: {json.dumps(done_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/providers")
async def list_providers(
    current_user: User = Depends(get_current_user),
) -> list[dict[str, str | bool]]:
    return llm_service.get_configured_providers()


@router.get("/providers/{provider}/models")
async def list_provider_models(
    provider: str,
    api_base: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[str]:
    try:
        return await llm_service.get_models(provider, api_base=api_base)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from None
