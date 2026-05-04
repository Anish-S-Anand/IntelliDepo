"""
Intelli Platform - Real-Time Engine
Feature: PLAT-6.26

Provides topic-based pub/sub over WebSocket and SSE.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.authentication import decode_token, get_user_by_id
from app.core.auth.dependencies import get_current_user
from app.database import get_db
from app.shared.models.user import User

router = APIRouter(prefix="/api/v1/realtime", tags=["Real-Time"])


class PublishRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=128)
    event_type: str = Field(default="message", min_length=1, max_length=64)
    payload: dict = Field(default_factory=dict)


class RealtimeEvent(BaseModel):
    id: str
    topic: str
    event_type: str
    payload: dict
    sender: str | None = None
    timestamp: datetime


class PublishResponse(BaseModel):
    delivered_to: int
    event: RealtimeEvent


class TopicSummary(BaseModel):
    topic: str
    subscribers: int


class RealTimeHub:
    def __init__(self) -> None:
        self._topics: dict[str, set[asyncio.Queue[RealtimeEvent]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, topic: str) -> asyncio.Queue[RealtimeEvent]:
        queue: asyncio.Queue[RealtimeEvent] = asyncio.Queue()
        async with self._lock:
            self._topics[topic].add(queue)
        return queue

    async def unsubscribe(self, topic: str, queue: asyncio.Queue[RealtimeEvent]) -> None:
        async with self._lock:
            subscribers = self._topics.get(topic)
            if not subscribers:
                return
            subscribers.discard(queue)
            if not subscribers:
                self._topics.pop(topic, None)

    async def publish(
        self,
        topic: str,
        event_type: str,
        payload: dict,
        *,
        sender: str | None = None,
    ) -> tuple[RealtimeEvent, int]:
        event = RealtimeEvent(
            id=str(uuid.uuid4()),
            topic=topic,
            event_type=event_type,
            payload=payload,
            sender=sender,
            timestamp=datetime.now(timezone.utc),
        )
        async with self._lock:
            subscribers = list(self._topics.get(topic, set()))

        for queue in subscribers:
            await queue.put(event)
        return event, len(subscribers)

    async def topic_summaries(self) -> list[TopicSummary]:
        async with self._lock:
            return [
                TopicSummary(topic=topic, subscribers=len(queues))
                for topic, queues in sorted(self._topics.items())
            ]


realtime_hub = RealTimeHub()


async def _authenticate_socket_user(token: str | None, db: AsyncSession) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        user = await get_user_by_id(db, uuid.UUID(payload["sub"]))
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


async def _sse_stream(topic: str, queue: asyncio.Queue[RealtimeEvent]) -> AsyncIterator[str]:
    try:
        heartbeat = 0
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
                payload = event.model_dump(mode="json")
                yield f"event: {event.event_type}\ndata: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                heartbeat += 1
                yield f"event: heartbeat\ndata: {json.dumps({'topic': topic, 'seq': heartbeat})}\n\n"
    finally:
        await realtime_hub.unsubscribe(topic, queue)


@router.get("/topics", response_model=list[TopicSummary])
async def list_topics(current_user: User = Depends(get_current_user)):
    return await realtime_hub.topic_summaries()


@router.post("/publish", response_model=PublishResponse)
async def publish_event(
    body: PublishRequest,
    current_user: User = Depends(get_current_user),
):
    event, delivered_to = await realtime_hub.publish(
        body.topic,
        body.event_type,
        body.payload,
        sender=current_user.email,
    )
    return PublishResponse(delivered_to=delivered_to, event=event)


@router.get("/stream/{topic}")
async def subscribe_sse(
    topic: str,
    token: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    await _authenticate_socket_user(token, db)
    queue = await realtime_hub.subscribe(topic)
    return StreamingResponse(_sse_stream(topic, queue), media_type="text/event-stream")


@router.websocket("/ws/{topic}")
async def subscribe_websocket(
    websocket: WebSocket,
    topic: str,
    token: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await _authenticate_socket_user(token, db)
    except HTTPException:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    queue = await realtime_hub.subscribe(topic)
    try:
        await websocket.send_json(
            {
                "type": "connected",
                "topic": topic,
                "user": user.email,
                "reconnect": True,
            }
        )

        async def forward_events() -> None:
            while True:
                event = await queue.get()
                await websocket.send_json(event.model_dump(mode="json"))

        async def receive_messages() -> None:
            while True:
                incoming = await websocket.receive_json()
                await realtime_hub.publish(
                    topic,
                    incoming.get("event_type", "message"),
                    incoming.get("payload", {}),
                    sender=user.email,
                )

        sender_task = asyncio.create_task(forward_events())
        receiver_task = asyncio.create_task(receive_messages())
        done, pending = await asyncio.wait(
            {sender_task, receiver_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        for task in done:
            exc = task.exception()
            if exc and not isinstance(exc, WebSocketDisconnect):
                raise exc
    except WebSocketDisconnect:
        pass
    finally:
        await realtime_hub.unsubscribe(topic, queue)
