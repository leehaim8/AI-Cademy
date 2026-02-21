from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from ..db import users_collection
from ..schemas import SignInPayload, SignUpPayload
from ..security import create_password_record, verify_password
from ..serializers import serialize_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
def signup(payload: SignUpPayload) -> dict:
    email = payload.email.strip().lower()
    salt_b64, pwd_hash = create_password_record(payload.password)

    user_doc = {
        "full_name": payload.full_name.strip(),
        "email": email,
        "password_salt": salt_b64,
        "password_hash": pwd_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = users_collection.insert_one(user_doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409, detail="A user with this email already exists."
        ) from exc

    created_user = users_collection.find_one({"_id": result.inserted_id})
    return {
        "message": "Account created successfully.",
        "user": serialize_user(created_user),
    }


@router.post("/signin")
def signin(payload: SignInPayload) -> dict:
    email = payload.email.strip().lower()
    user = users_collection.find_one({"email": email})

    if not user or not verify_password(
        payload.password,
        user["password_salt"],
        user["password_hash"],
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "message": "Signed in successfully.",
        "user": serialize_user(user),
    }
