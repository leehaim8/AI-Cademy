from __future__ import annotations

import base64
import hashlib
import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, EmailStr, Field

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ai_cademy")


class SignUpPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class SignInPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class UpdateUserPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


def get_users_collection() -> Collection:
    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    return db["users"]


users_collection = get_users_collection()


def init_indexes() -> None:
    users_collection.create_index([("email", ASCENDING)], unique=True)


def hash_password(password: str, salt: bytes) -> str:
    hashed = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, 100_000
    )
    return base64.b64encode(hashed).decode("utf-8")


def create_password_record(password: str) -> tuple[str, str]:
    salt = os.urandom(16)
    salt_b64 = base64.b64encode(salt).decode("utf-8")
    pwd_hash = hash_password(password, salt)
    return salt_b64, pwd_hash


def verify_password(password: str, salt_b64: str, expected_hash: str) -> bool:
    salt = base64.b64decode(salt_b64.encode("utf-8"))
    computed_hash = hash_password(password, salt)
    return computed_hash == expected_hash


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


app = FastAPI(title="AI Cademy Auth API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_indexes()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/signup")
def signup(payload: SignUpPayload) -> dict:
    email = payload.email.strip().lower()
    salt_b64, pwd_hash = create_password_record(payload.password)
    created_at = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "full_name": payload.full_name.strip(),
        "email": email,
        "password_salt": salt_b64,
        "password_hash": pwd_hash,
        "created_at": created_at,
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


@app.post("/auth/signin")
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


@app.get("/users")
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


@app.get("/users/{user_id}")
def get_user(user_id: str) -> dict:
    object_id = parse_user_id(user_id)
    user = users_collection.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user": serialize_user(user)}


@app.patch("/users/{user_id}")
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
