from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import users_collection
from ..schemas import UpdateUserPayload
from ..serializers import parse_user_id, serialize_user

router = APIRouter(tags=["users"])


@router.get("/users")
def list_users() -> dict[str, list[dict]]:
    docs = users_collection.find(
        {},
        {
            "full_name": 1,
            "email": 1,
            "created_at": 1,
        },
    ).sort("_id", -1)
    return {"users": [serialize_user(doc) for doc in docs]}


@router.get("/users/{user_id}")
def get_user(user_id: str) -> dict:
    object_id = parse_user_id(user_id)
    user = users_collection.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user": serialize_user(user)}


@router.patch("/users/{user_id}")
def update_user(user_id: str, payload: UpdateUserPayload) -> dict:
    object_id = parse_user_id(user_id)
    result = users_collection.update_one(
        {"_id": object_id},
        {"$set": {"full_name": payload.full_name.strip()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found.")

    user = users_collection.find_one({"_id": object_id})
    return {"message": "Profile updated.", "user": serialize_user(user)}
