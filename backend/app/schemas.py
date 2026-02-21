from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class SignUpPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class SignInPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class UpdateUserPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
