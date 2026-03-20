from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field
from typing import Any, Literal, Optional


class SignUpPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class SignInPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class UpdateUserPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


class CourseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    owner_user_id: str
    code: Optional[str] = None
    term: Optional[str] = None


class CourseOut(BaseModel):
    id: str
    name: str
    owner_user_id: str
    code: Optional[str] = None
    term: Optional[str] = None
    created_at: Optional[str] = None


class CourseMemberCreate(BaseModel):
    user_id: str
    role_in_course: Optional[Literal["lecturer", "ta", "student"]] = "lecturer"


class CourseMemberOut(BaseModel):
    id: str
    course_id: str
    user_id: str
    role_in_course: Optional[Literal["lecturer", "ta", "student"]] = None


class CourseAgentUpdate(BaseModel):
    agent_key: str
    enabled: bool


class CourseAgentOut(BaseModel):
    id: str
    course_id: str
    agent_key: str
    enabled: bool


class SessionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    notes: Optional[str] = None


class SessionOut(BaseModel):
    id: str
    course_id: str
    agent_key: str
    title: str
    notes: Optional[str] = None
    created_at: str
    created_by_user_id: Optional[str] = None


class SessionRunCreate(BaseModel):
    input_data: Any
    output_data: Any
    status: Literal["success", "error", "running"] = "running"


class SessionRunOut(BaseModel):
    id: str
    session_id: str
    input_data: Any
    output_data: Any
    status: Literal["success", "error", "running"]
    created_at: str


class TopicExtractionRequest(BaseModel):
    seminar_topic: str = Field(min_length=3, max_length=300)
    sources: list[str] = Field(default_factory=list)
    raw_text: Optional[str] = Field(default=None, max_length=200_000)
    similarity_threshold: float = Field(default=0.68, ge=0.0, le=1.0)
    include_summary: bool = False


class TopicExtractionResponse(BaseModel):
    run_id: Optional[str] = None
    all_topics: list[str]
    clusters: list[list[str]]
    summary_md: Optional[str] = None


class TopicExtractionEditRequest(BaseModel):
    edited_topics: list[str] = Field(default_factory=list)


class SyllabusGenerationRequest(BaseModel):
    topics: list[str] = Field(default_factory=list, min_length=1)
    num_weeks: int = Field(default=12, ge=1, le=52)
    audience: str = Field(default="University students", min_length=2, max_length=200)
    constraints: Optional[str] = Field(default=None, max_length=2000)


class SyllabusWeekOut(BaseModel):
    week: int
    central_topic: str
    topics: list[str]


class SyllabusGenerationResponse(BaseModel):
    weeks: list[SyllabusWeekOut]
