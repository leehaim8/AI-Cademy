from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..db import session_runs_collection
from ..schemas import SessionRunCreate
from ..serializers import parse_session_id, serialize_session_run

router = APIRouter(prefix="/sessions/{session_id}/runs", tags=["session-runs"])


@router.get("")
def list_session_runs(session_id: str) -> dict:
    object_id = parse_session_id(session_id)
    docs = session_runs_collection.find({"session_id": object_id}).sort("_id", -1)
    return {"runs": [serialize_session_run(doc) for doc in docs]}


@router.post("")
def create_session_run(session_id: str, payload: SessionRunCreate) -> dict:
    object_id = parse_session_id(session_id)
    doc = {
        "session_id": object_id,
        "input_data": payload.input_data,
        "output_data": payload.output_data,
        "status": payload.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = session_runs_collection.insert_one(doc)
    run = session_runs_collection.find_one({"_id": result.inserted_id})
    return {"run": serialize_session_run(run)}
