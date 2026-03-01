from __future__ import annotations

from fastapi import APIRouter

from ..db import course_agents_collection
from ..schemas import CourseAgentUpdate
from ..serializers import parse_course_id, serialize_course_agent

router = APIRouter(prefix="/courses/{course_id}/agents", tags=["course-agents"])


@router.get("")
def list_course_agents(course_id: str) -> dict:
    course_object_id = parse_course_id(course_id)
    docs = course_agents_collection.find({"course_id": course_object_id})
    return {"agents": [serialize_course_agent(doc) for doc in docs]}


@router.put("")
def update_course_agents(course_id: str, payload: list[CourseAgentUpdate]) -> dict:
    course_object_id = parse_course_id(course_id)
    updated = []
    for entry in payload:
        course_agents_collection.update_one(
            {"course_id": course_object_id, "agent_key": entry.agent_key},
            {"$set": {"enabled": entry.enabled}},
            upsert=True,
        )
        doc = course_agents_collection.find_one(
            {"course_id": course_object_id, "agent_key": entry.agent_key}
        )
        if doc:
            updated.append(serialize_course_agent(doc))
    return {"agents": updated}
