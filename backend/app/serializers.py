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


def parse_user_id(user_id: str) -> ObjectId:
    try:
        return ObjectId(user_id)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid user id.") from exc
