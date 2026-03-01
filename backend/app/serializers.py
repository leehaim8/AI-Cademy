from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def serialize_user(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "full_name": document["full_name"],
        "email": document["email"],
        "created_at": document["created_at"],
    }


def parse_object_id(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.") from exc


def parse_user_id(user_id: str) -> ObjectId:
    return parse_object_id(user_id, "user id")


def parse_course_id(course_id: str) -> ObjectId:
    return parse_object_id(course_id, "course id")


def parse_session_id(session_id: str) -> ObjectId:
    return parse_object_id(session_id, "session id")


def serialize_course(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "name": document["name"],
        "owner_user_id": str(document["owner_user_id"]),
        "code": document.get("code"),
        "term": document.get("term"),
        "created_at": document.get("created_at"),
    }


def serialize_course_member(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "course_id": str(document["course_id"]),
        "user_id": str(document["user_id"]),
        "role_in_course": document.get("role_in_course"),
    }


def serialize_course_agent(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "course_id": str(document["course_id"]),
        "agent_key": document["agent_key"],
        "enabled": document["enabled"],
    }


def serialize_session(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "course_id": str(document["course_id"]),
        "agent_key": document["agent_key"],
        "title": document["title"],
        "notes": document.get("notes"),
        "created_at": document["created_at"],
        "created_by_user_id": (
            str(document["created_by_user_id"]) if document.get("created_by_user_id") else None
        ),
    }


def serialize_session_run(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "session_id": str(document["session_id"]),
        "input_data": document.get("input_data"),
        "output_data": document.get("output_data"),
        "status": document["status"],
        "created_at": document["created_at"],
    }
