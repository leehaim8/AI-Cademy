from __future__ import annotations

import base64
import hashlib
import os


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
