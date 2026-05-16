from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import CodeReviewOptionsResponse, CodeReviewRequest, CodeReviewResponse
from ..services.code_review_agent import (
    get_code_review_options,
    review_submitted_code,
    run_generated_code_review,
)


router = APIRouter(prefix="/code-review", tags=["code-review"])


@router.get("/options", response_model=CodeReviewOptionsResponse)
def list_code_review_options() -> CodeReviewOptionsResponse:
    try:
        options = get_code_review_options()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Code review agent options failed: {exc}",
        ) from exc

    return CodeReviewOptionsResponse(**options)


@router.post("/run", response_model=CodeReviewResponse)
def run_code_review(payload: CodeReviewRequest) -> CodeReviewResponse:
    try:
        if payload.code and payload.code.strip():
            result = review_submitted_code(
                language=payload.language,
                difficulty_level=payload.difficulty_level,
                code=payload.code,
                exercise_description=payload.exercise_description,
            )
        elif payload.generate_sample_if_empty:
            result = run_generated_code_review(
                language=payload.language,
                difficulty_level=payload.difficulty_level,
            )
        else:
            raise ValueError("Provide code to review, or enable sample generation.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Code review failed: {exc}",
        ) from exc

    return CodeReviewResponse(**result)
