from __future__ import annotations

from fastapi import APIRouter

from ..db import course_members_collection
from ..schemas import CourseMemberCreate
from ..serializers import (
    parse_course_id,
    parse_user_id,
    serialize_course_member,
)

router = APIRouter(prefix="/courses/{course_id}/members", tags=["course-members"])


@router.get("")
def list_members(course_id: str) -> dict:
    course_object_id = parse_course_id(course_id)
    docs = course_members_collection.find({"course_id": course_object_id})
    return {"members": [serialize_course_member(doc) for doc in docs]}


@router.post("")
def add_member(course_id: str, payload: CourseMemberCreate) -> dict:
    course_object_id = parse_course_id(course_id)
    user_object_id = parse_user_id(payload.user_id)
    doc = {
        "course_id": course_object_id,
        "user_id": user_object_id,
        "role_in_course": payload.role_in_course,
    }
    result = course_members_collection.insert_one(doc)
    created = course_members_collection.find_one({"_id": result.inserted_id})
    return {"member": serialize_course_member(created)}
