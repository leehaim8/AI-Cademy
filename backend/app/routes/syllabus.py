from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import SyllabusGenerationRequest, SyllabusGenerationResponse
from ..services.syllabus_agent import generate_syllabus

router = APIRouter(prefix="/syllabus", tags=["syllabus"])


@router.post("/generate", response_model=SyllabusGenerationResponse)
def generate_syllabus_route(
    payload: SyllabusGenerationRequest,
) -> SyllabusGenerationResponse:
    try:
        weeks = generate_syllabus(
            topics=payload.topics,
            num_weeks=payload.num_weeks,
            weekly_hours=payload.weekly_hours,
            audience=payload.audience,
            constraints=payload.constraints,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Syllabus generation failed: {exc}") from exc

    return SyllabusGenerationResponse(weeks=weeks)
