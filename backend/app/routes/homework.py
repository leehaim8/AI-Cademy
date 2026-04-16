from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..schemas import (
    HomeworkCheckEvidenceOut,
    HomeworkCheckRequest,
    HomeworkCheckRequirementResultOut,
    HomeworkCheckResponse,
    HomeworkGenerationRequest,
    HomeworkGenerationResponse,
)
from ..services.homework_agent import generate_homework, get_openai_client
from ..services.homework_checker import check_homework
from ..services.booklet_agent import extract_text_from_upload


router = APIRouter(prefix="/homework", tags=["homework"])


def _validate_homework_payload(payload: HomeworkGenerationRequest) -> None:
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


@router.post("/generate", response_model=HomeworkGenerationResponse)
def generate_homework_set(
    payload: HomeworkGenerationRequest,
) -> HomeworkGenerationResponse:
    _validate_homework_payload(payload)

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


@router.post("/generate/upload", response_model=HomeworkGenerationResponse)
async def generate_homework_from_upload(
    file: UploadFile = File(...),
    chapter_title: str = Form(""),
    mcq_question_count: int = Form(0),
    open_question_count: int = Form(0),
    base_difficulty: str = Form("medium"),
    points_per_question: int = Form(10),
    mcq_option_count: int = Form(0),
    mcq_correct_count: int = Form(1),
) -> HomeworkGenerationResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Upload a chapter file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        extracted_text = extract_text_from_upload(file.filename, content)
        payload = HomeworkGenerationRequest(
            chapter_text=extracted_text,
            chapter_title=chapter_title.strip() or file.filename,
            mcq_question_count=mcq_question_count,
            open_question_count=open_question_count,
            base_difficulty=base_difficulty,
            points_per_question=points_per_question,
            mcq_option_count=mcq_option_count,
            mcq_correct_count=mcq_correct_count,
        )
        _validate_homework_payload(payload)
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


@router.post("/check", response_model=HomeworkCheckResponse)
def check_homework_submission(
    payload: HomeworkCheckRequest,
) -> HomeworkCheckResponse:
    try:
        result = check_homework(
            assignment_id=payload.assignment_id,
            title=payload.title,
            assignment_text=payload.assignment_text,
            questions_text=payload.questions_text,
            rubric_text=payload.rubric_text,
            submission_id=payload.submission_id,
            student_id=payload.student_id,
            student_answer_text=payload.student_answer_text,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Homework checking failed: {exc}",
        ) from exc

    return HomeworkCheckResponse(
        submission_id=result.submission_id,
        total_score=result.total_score,
        per_question_scores=result.per_question_scores,
        overall_feedback=result.overall_feedback,
        per_requirement_results=[
            HomeworkCheckRequirementResultOut(
                rubric_item_id=item.rubric_item_id,
                question_id=item.question_id,
                status=item.status,
                score=item.score * 100.0,
                feedback=item.feedback,
                evidence=HomeworkCheckEvidenceOut(
                    answer_snippet=item.evidence.get("answer_snippet"),
                    concept_score=item.evidence.get("concept_score"),
                    matched_concepts=item.evidence.get("matched_concepts") or [],
                    missing_concepts=item.evidence.get("missing_concepts") or [],
                    semantic_score=item.evidence.get("semantic_score"),
                    semantic_explanation=item.evidence.get("semantic_explanation"),
                ),
            )
            for item in result.per_requirement_results
        ],
    )
