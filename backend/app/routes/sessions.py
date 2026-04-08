from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from ..db import session_runs_collection, sessions_collection
from ..schemas import SessionCreate
from ..serializers import serialize_session, serialize_session_run

router = APIRouter(tags=["sessions"])


@router.get("/courses/{course_id}/agents/{agent_key}/sessions")
def list_sessions(course_id: str, agent_key: str) -> dict:
    docs = sessions_collection.find(
        {"course_id": course_id, "agent_key": agent_key}
    ).sort("_id", -1)
    return {"sessions": [serialize_session(doc) for doc in docs]}


@router.get("/courses/{course_id}/agents/{agent_key}/session-runs")
def list_runs_for_course_agent(course_id: str, agent_key: str) -> dict:
    docs = session_runs_collection.aggregate(
        [
            {
                "$lookup": {
                    "from": "sessions",
                    "localField": "session_id",
                    "foreignField": "public_id",
                    "as": "session_docs",
                }
            },
            {"$unwind": "$session_docs"},
            {
                "$match": {
                    "session_docs.course_id": course_id,
                    "session_docs.agent_key": agent_key,
                }
            },
            {"$sort": {"_id": -1}},
        ]
    )
    return {"runs": [serialize_session_run(doc) for doc in docs]}


@router.post("/courses/{course_id}/agents/{agent_key}/sessions")
def create_session(course_id: str, agent_key: str, payload: SessionCreate) -> dict:
    doc = {
        "public_id": str(uuid4()),
        "course_id": course_id,
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
    result = sessions_collection.update_one(
        {"public_id": session_id},
        {
            "$set": {
                "title": payload.title.strip(),
                "notes": payload.notes.strip() if payload.notes else None,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = sessions_collection.find_one({"public_id": session_id})
    return {"session": serialize_session(session)}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str) -> dict:
    session = sessions_collection.find_one({"public_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    sessions_collection.delete_one({"_id": session["_id"]})
    session_runs_collection.delete_many({"session_id": session_id})
    return {"deleted": True}
