from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..db import topic_extraction_collection
from ..schemas import (
    TopicExtractionEditRequest,
    TopicExtractionRequest,
    TopicExtractionResponse,
)
from ..serializers import parse_object_id
from ..services.topic_extractor import (
    extract_text_from_uploaded_file,
    summarize_clusters_with_llm,
    topic_extraction_agent,
)

router = APIRouter(prefix="/topic-extraction", tags=["topic-extraction"])


@router.post("", response_model=TopicExtractionResponse)
def extract_topics(payload: TopicExtractionRequest) -> TopicExtractionResponse:
    has_raw_text = bool(payload.raw_text and payload.raw_text.strip())
    has_sources = len(payload.sources) > 0

    if not has_raw_text and not has_sources:
        raise HTTPException(status_code=400, detail="Provide sources or raw_text.")

    sources = list(payload.sources)
    if has_raw_text:
        sources.insert(0, payload.raw_text.strip())

    try:
        result = topic_extraction_agent(
            seminar_topic=payload.seminar_topic,
            sources=sources,
            similarity_threshold=payload.similarity_threshold,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Topic extraction failed: {exc}",
        ) from exc

    summary_md = None
    if payload.include_summary and result["clusters"]:
        try:
            summary_md = summarize_clusters_with_llm(
                payload.seminar_topic,
                result["clusters"],
            )
        except Exception:
            summary_md = None

    insert_result = topic_extraction_collection.insert_one(
        {
            "source_type": "json",
            "seminar_topic": payload.seminar_topic,
            "similarity_threshold": payload.similarity_threshold,
            "include_summary": payload.include_summary,
            "input_data": {
                "raw_text": payload.raw_text,
                "sources": payload.sources,
            },
            "output_data": {
                "all_topics": result["all_topics"],
                "clusters": result["clusters"],
                "summary_md": summary_md,
            },
            "edited_topics": result["all_topics"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return TopicExtractionResponse(
        run_id=str(insert_result.inserted_id),
        all_topics=result["all_topics"],
        clusters=result["clusters"],
        summary_md=summary_md,
    )


@router.post("/upload", response_model=TopicExtractionResponse)
async def extract_topics_from_uploads(
    seminar_topic: str = Form(...),
    similarity_threshold: float = Form(0.68),
    include_summary: bool = Form(False),
    raw_text: str = Form(""),
    files: list[UploadFile] | None = File(default=None),
) -> TopicExtractionResponse:
    sources: list[str] = []
    uploaded_filenames: list[str] = []

    cleaned_raw_text = raw_text.strip()
    if cleaned_raw_text:
        sources.append(cleaned_raw_text)

    for uploaded in files or []:
        filename = uploaded.filename or "uploaded_file"
        uploaded_filenames.append(filename)
        content = await uploaded.read()
        if not content:
            continue
        extracted = extract_text_from_uploaded_file(filename, content).strip()
        if extracted:
            sources.append(extracted)

    if not sources:
        raise HTTPException(status_code=400, detail="Provide files or raw_text.")

    try:
        result = topic_extraction_agent(
            seminar_topic=seminar_topic.strip(),
            sources=sources,
            similarity_threshold=similarity_threshold,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Topic extraction failed: {exc}",
        ) from exc

    summary_md = None
    if include_summary and result["clusters"]:
        try:
            summary_md = summarize_clusters_with_llm(seminar_topic, result["clusters"])
        except Exception:
            summary_md = None

    insert_result = topic_extraction_collection.insert_one(
        {
            "source_type": "upload",
            "seminar_topic": seminar_topic,
            "similarity_threshold": similarity_threshold,
            "include_summary": include_summary,
            "input_data": {
                "raw_text": cleaned_raw_text or None,
                "uploaded_files": uploaded_filenames,
                "source_count": len(sources),
            },
            "output_data": {
                "all_topics": result["all_topics"],
                "clusters": result["clusters"],
                "summary_md": summary_md,
            },
            "edited_topics": result["all_topics"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return TopicExtractionResponse(
        run_id=str(insert_result.inserted_id),
        all_topics=result["all_topics"],
        clusters=result["clusters"],
        summary_md=summary_md,
    )


@router.patch("/{run_id}")
def update_edited_topics(
    run_id: str,
    payload: TopicExtractionEditRequest,
) -> dict[str, list[str] | str]:
    object_id = parse_object_id(run_id, "topic extraction id")

    cleaned_topics = [topic.strip() for topic in payload.edited_topics if topic.strip()]

    result = topic_extraction_collection.update_one(
        {"_id": object_id},
        {
            "$set": {
                "edited_topics": cleaned_topics,
                "output_data.all_topics": cleaned_topics,
                "output_data.edited_topics": cleaned_topics,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Topic extraction run not found.")

    return {
        "run_id": run_id,
        "edited_topics": cleaned_topics,
    }
    