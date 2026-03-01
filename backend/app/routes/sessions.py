from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..db import sessions_collection
from ..schemas import SessionCreate
from ..serializers import (
    parse_course_id,
    parse_session_id,
    serialize_session,
)

router = APIRouter(tags=["sessions"])


@router.get("/courses/{course_id}/agents/{agent_key}/sessions")
def list_sessions(course_id: str, agent_key: str) -> dict:
    course_object_id = parse_course_id(course_id)
    docs = sessions_collection.find(
        {"course_id": course_object_id, "agent_key": agent_key}
    ).sort("_id", -1)
    return {"sessions": [serialize_session(doc) for doc in docs]}


@router.post("/courses/{course_id}/agents/{agent_key}/sessions")
def create_session(course_id: str, agent_key: str, payload: SessionCreate) -> dict:
    course_object_id = parse_course_id(course_id)
    doc = {
        "course_id": course_object_id,
        "agent_key": agent_key,
        "title": payload.title.strip(),
        "notes": payload.notes.strip() if payload.notes else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = sessions_collection.insert_one(doc)
    session = sessions_collection.find_one({"_id": result.inserted_id})
    return {"session": serialize_session(session)}


@router.patch("/sessions/{session_id}")
def update_session(session_id: str, payload: SessionCreate) -> dict:
    object_id = parse_session_id(session_id)
    result = sessions_collection.update_one(
        {"_id": object_id},
        {
            "$set": {
                "title": payload.title.strip(),
                "notes": payload.notes.strip() if payload.notes else None,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = sessions_collection.find_one({"_id": object_id})
    return {"session": serialize_session(session)}
