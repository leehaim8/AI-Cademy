from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..schemas import (
    BookletChapterRequest,
    BookletChapterResponse,
    BookletOutlineRequest,
    BookletOutlineResponse,
)
from ..services.booklet_agent import (
    align_chapter,
    build_course_map,
    build_outline_from_course_map,
    extract_text_from_upload,
    get_openai_client,
    generate_chapter,
    syllabus_text_from_weeks,
)

router = APIRouter(prefix="/booklet", tags=["booklet"])


@router.post("/outline", response_model=BookletOutlineResponse)
def generate_booklet_outline(payload: BookletOutlineRequest) -> BookletOutlineResponse:
    syllabus_text = (payload.syllabus_text or "").strip()
    weeks = payload.weeks or []

    if not syllabus_text and not weeks:
        raise HTTPException(status_code=400, detail="Provide syllabus_text or weeks.")

    if not syllabus_text and weeks:
        syllabus_text = syllabus_text_from_weeks([week.dict() for week in weeks])

    try:
        client = get_openai_client()
        course_map = build_course_map(syllabus_text, client)
        outline = build_outline_from_course_map(course_map)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Booklet outline generation failed: {exc}"
        ) from exc

    return BookletOutlineResponse(
        outline=outline,
        course_map=course_map,
        source_type="weeks" if weeks else "text",
    )


@router.post("/outline/upload", response_model=BookletOutlineResponse)
async def generate_booklet_outline_from_upload(
    file: UploadFile = File(...),
    course_name: str = Form(""),
) -> BookletOutlineResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Upload a syllabus file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        syllabus_text = extract_text_from_upload(file.filename, content)
        if not syllabus_text.strip():
            raise ValueError("Failed to extract text from the uploaded file.")
        client = get_openai_client()
        course_map = build_course_map(syllabus_text, client)
        outline = build_outline_from_course_map(course_map)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Booklet outline generation failed: {exc}"
        ) from exc

    return BookletOutlineResponse(
        outline=outline,
        course_map=course_map,
        source_type="upload",
        course_name=course_name.strip() or None,
    )


@router.post("/chapter", response_model=BookletChapterResponse)
def generate_booklet_chapter(payload: BookletChapterRequest) -> BookletChapterResponse:
    chapter_name = payload.chapter_name.strip()
    if not chapter_name:
        raise HTTPException(status_code=400, detail="chapter_name is required.")

    try:
        client = get_openai_client()
        draft_md = generate_chapter(
            chapter_name=chapter_name,
            course_map=payload.course_map,
            client=client,
            output_language=payload.output_language,
            tone=payload.tone,
        )
        final_md = align_chapter(
            chapter_name=chapter_name,
            chapter_text=draft_md,
            course_map=payload.course_map,
            client=client,
            output_language=payload.output_language,
            tone=payload.tone,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Booklet chapter generation failed: {exc}"
        ) from exc

    return BookletChapterResponse(
        chapter_name=chapter_name,
        draft_md=draft_md,
        final_md=final_md,
    )
