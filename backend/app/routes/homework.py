from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import HomeworkGenerationRequest, HomeworkGenerationResponse
from ..services.homework_agent import generate_homework, get_openai_client


router = APIRouter(prefix="/homework", tags=["homework"])


@router.post("/generate", response_model=HomeworkGenerationResponse)
def generate_homework_set(
    payload: HomeworkGenerationRequest,
) -> HomeworkGenerationResponse:
    if payload.mcq_question_count + payload.open_question_count < 1:
        raise HTTPException(
            status_code=400,
            detail="Choose at least one homework question.",
        )

    if payload.mcq_question_count > 0:
        if payload.mcq_option_count < 2:
            raise HTTPException(
                status_code=400,
                detail="Multiple-choice questions need at least 2 answer options.",
            )
        if payload.mcq_correct_count < 1:
            raise HTTPException(
                status_code=400,
                detail="Multiple-choice questions need at least 1 correct answer.",
            )
        if payload.mcq_correct_count > payload.mcq_option_count:
            raise HTTPException(
                status_code=400,
                detail="Correct answers cannot exceed the number of options.",
            )

    try:
        client = get_openai_client()
        questions = generate_homework(payload, client)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Homework generation failed: {exc}",
        ) from exc

    return HomeworkGenerationResponse(
        chapter_title=payload.chapter_title.strip() if payload.chapter_title else None,
        questions=questions,
    )
