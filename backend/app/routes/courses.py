from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from ..db import (
    course_agents_collection,
    course_members_collection,
    courses_collection,
    session_runs_collection,
    sessions_collection,
)
from ..schemas import CourseCreate, CourseUpdate
from ..serializers import parse_user_id, parse_course_id, serialize_course

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("")
def list_courses(user_id: str = Query(default="")) -> dict:
    if not user_id:
        docs = courses_collection.find({}).sort("_id", -1)
        return {"courses": [serialize_course(doc) for doc in docs]}

    user_object_id = parse_user_id(user_id)
    owned = list(courses_collection.find({"owner_user_id": user_object_id}))
    member_course_ids = [
        member["course_id"]
        for member in course_members_collection.find({"user_id": user_object_id})
    ]
    shared = list(courses_collection.find({"_id": {"$in": member_course_ids}}))

    merged = {str(course["_id"]): course for course in owned + shared}
    return {"courses": [serialize_course(doc) for doc in merged.values()]}


@router.post("")
def create_course(payload: CourseCreate) -> dict:
    owner_object_id = parse_user_id(payload.owner_user_id)
    course_doc = {
        "name": payload.name.strip(),
        "owner_user_id": owner_object_id,
        "code": payload.code.strip() if payload.code else None,
        "term": payload.term.strip() if payload.term else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = courses_collection.insert_one(course_doc)
    course = courses_collection.find_one({"_id": result.inserted_id})
    return {"course": serialize_course(course)}


@router.get("/{course_id}")
def get_course(course_id: str) -> dict:
    object_id = parse_course_id(course_id)
    course = courses_collection.find_one({"_id": object_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    return {"course": serialize_course(course)}


@router.patch("/{course_id}")
def update_course(course_id: str, payload: CourseUpdate) -> dict:
    object_id = parse_course_id(course_id)
    result = courses_collection.update_one(
        {"_id": object_id},
        {
            "$set": {
                "name": payload.name.strip(),
                "code": payload.code.strip() if payload.code else None,
                "term": payload.term.strip() if payload.term else None,
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Course not found.")

    course = courses_collection.find_one({"_id": object_id})
    return {"course": serialize_course(course)}


@router.delete("/{course_id}")
def delete_course(course_id: str) -> dict:
    object_id = parse_course_id(course_id)
    course = courses_collection.find_one({"_id": object_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    session_public_ids = [
        session.get("public_id")
        for session in sessions_collection.find({"course_id": course_id}, {"public_id": 1})
        if session.get("public_id")
    ]

    courses_collection.delete_one({"_id": object_id})
    course_members_collection.delete_many({"course_id": object_id})
    course_agents_collection.delete_many({"course_id": object_id})
    sessions_collection.delete_many({"course_id": course_id})
    if session_public_ids:
        session_runs_collection.delete_many({"session_id": {"$in": session_public_ids}})

    return {"deleted": True}
