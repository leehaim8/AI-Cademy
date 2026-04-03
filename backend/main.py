from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .app.config import ALLOWED_ORIGINS
from .app.db import init_indexes
from .app.routes.auth import router as auth_router
from .app.routes.users import router as users_router
from .app.routes.courses import router as courses_router
from .app.routes.course_members import router as course_members_router
from .app.routes.course_agents import router as course_agents_router
from .app.routes.sessions import router as sessions_router
from .app.routes.session_runs import router as session_runs_router
from .app.routes.syllabus import router as syllabus_router
from .app.routes.topic_extraction import router as topic_extraction_router
from .app.routes.booklet import router as booklet_router

app = FastAPI(title="AI Cademy Auth API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(courses_router)
app.include_router(course_members_router)
app.include_router(course_agents_router)
app.include_router(sessions_router)
app.include_router(session_runs_router)
app.include_router(syllabus_router)
app.include_router(topic_extraction_router)
app.include_router(booklet_router)
