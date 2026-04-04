from __future__ import annotations

import os
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel, Field

from ..schemas import (
    HomeworkGenerationRequest,
    HomeworkOptionOut,
    HomeworkQuestionOut,
)


HOMEWORK_MODEL = os.getenv("HOMEWORK_MODEL", "gpt-4.1")


class HomeworkOption(BaseModel):
    label: str
    text: str
    is_correct: bool


class HomeworkQuestion(BaseModel):
    type: Literal["mcq", "open"]
    difficulty: Literal["easy", "medium", "difficult"]
    prompt: str
    student_answer: str
    grading_criteria: list[str] = Field(default_factory=list)
    options: list[HomeworkOption] = Field(default_factory=list)
    correct_answers_count: int | None = None


class HomeworkGenerationResult(BaseModel):
    questions: list[HomeworkQuestion] = Field(default_factory=list)


def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured for the homework agent.")
    return OpenAI(api_key=api_key)


def generate_homework(
    payload: HomeworkGenerationRequest,
    client: OpenAI,
) -> list[HomeworkQuestionOut]:
    response = client.responses.parse(
        model=HOMEWORK_MODEL,
        input=[
            {
                "role": "system",
                "content": (
                    "You are an expert university teaching assistant who writes clear homework questions.\n"
                    "Generate questions only from the supplied chapter.\n"
                    "Return student-friendly model answers, not lecturer shorthand.\n"
                    "Each question must include explicit grading criteria.\n"
                    "Respect the requested counts exactly."
                ),
            },
            {"role": "user", "content": _build_prompt(payload)},
        ],
        text_format=HomeworkGenerationResult,
    )

    parsed = response.output_parsed
    if parsed is None:
        raise RuntimeError("Homework generation returned no structured output.")

    return _normalize_questions(parsed.questions, payload)


def _build_prompt(payload: HomeworkGenerationRequest) -> str:
    chapter_title = payload.chapter_title.strip() if payload.chapter_title else "Imported chapter"
    return (
        f"Chapter title: {chapter_title}\n"
        f"Base requested difficulty: {payload.base_difficulty}\n"
        f"Points per question: {payload.points_per_question}\n"
        f"Number of multiple-choice questions: {payload.mcq_question_count}\n"
        f"Number of open-ended questions: {payload.open_question_count}\n"
        f"Multiple-choice options per question: {payload.mcq_option_count}\n"
        f"Number of correct answers per multiple-choice question: {payload.mcq_correct_count}\n\n"
        "Requirements:\n"
        "1. Generate exactly the requested number of questions of each type.\n"
        "2. Use only content that can be grounded in the supplied chapter text.\n"
        "3. For every question, provide:\n"
        "   - prompt\n"
        "   - difficulty rated as easy, medium, or difficult\n"
        "   - a detailed student-friendly answer\n"
        "   - grading_criteria as 3 to 5 short bullet-style strings\n"
        "4. For multiple-choice questions:\n"
        "   - include exactly the requested number of options\n"
        "   - mark exactly the requested number of correct options using is_correct\n"
        "   - make distractors plausible\n"
        "   - set correct_answers_count to the number of correct options\n"
        "5. For open-ended questions:\n"
        "   - options should be empty\n"
        "   - correct_answers_count should be null\n"
        "6. Keep answers understandable to students.\n\n"
        f"Chapter text:\n{payload.chapter_text.strip()}"
    )


def _normalize_questions(
    questions: list[HomeworkQuestion],
    payload: HomeworkGenerationRequest,
) -> list[HomeworkQuestionOut]:
    mcq_questions = [question for question in questions if question.type == "mcq"]
    open_questions = [question for question in questions if question.type == "open"]

    normalized: list[HomeworkQuestionOut] = []
    normalized.extend(
        _normalize_group(
            mcq_questions,
            count=payload.mcq_question_count,
            question_type="mcq",
            points=payload.points_per_question,
            option_count=payload.mcq_option_count,
            correct_count=payload.mcq_correct_count,
        )
    )
    normalized.extend(
        _normalize_group(
            open_questions,
            count=payload.open_question_count,
            question_type="open",
            points=payload.points_per_question,
            option_count=0,
            correct_count=0,
        )
    )

    return normalized


def _normalize_group(
    questions: list[HomeworkQuestion],
    *,
    count: int,
    question_type: Literal["mcq", "open"],
    points: int,
    option_count: int,
    correct_count: int,
) -> list[HomeworkQuestionOut]:
    normalized: list[HomeworkQuestionOut] = []

    for index in range(count):
        source = questions[index] if index < len(questions) else None
        prompt = source.prompt.strip() if source and source.prompt.strip() else _fallback_prompt(question_type, index)
        answer = (
            source.student_answer.strip()
            if source and source.student_answer.strip()
            else "Review the related section in the chapter and explain the core idea clearly, with supporting details from the text."
        )
        criteria = _normalize_criteria(source.grading_criteria if source else [])
        difficulty = source.difficulty if source else "medium"

        if question_type == "mcq":
            options = _normalize_options(source.options if source else [], option_count, correct_count)
            normalized.append(
                HomeworkQuestionOut(
                    id=f"{question_type}-{index + 1}",
                    type="mcq",
                    difficulty=difficulty,
                    points=points,
                    prompt=prompt,
                    student_answer=answer,
                    grading_criteria=criteria,
                    options=options,
                    correct_answers_count=sum(1 for option in options if option.is_correct),
                )
            )
            continue

        normalized.append(
            HomeworkQuestionOut(
                id=f"{question_type}-{index + 1}",
                type="open",
                difficulty=difficulty,
                points=points,
                prompt=prompt,
                student_answer=answer,
                grading_criteria=criteria,
                options=[],
                correct_answers_count=None,
            )
        )

    return normalized


def _normalize_options(
    options: list[HomeworkOption],
    option_count: int,
    correct_count: int,
) -> list[HomeworkOptionOut]:
    trimmed = options[:option_count]
    normalized: list[HomeworkOption] = []

    for index in range(option_count):
        source = trimmed[index] if index < len(trimmed) else None
        label = chr(65 + index)
        text = source.text.strip() if source and source.text.strip() else f"Option {label}"
        normalized.append(
            HomeworkOption(
                label=label,
                text=text,
                is_correct=bool(source.is_correct) if source else False,
            )
        )

    current_correct = [idx for idx, option in enumerate(normalized) if option.is_correct]
    if len(current_correct) < correct_count:
        for idx in range(option_count):
            if idx not in current_correct:
                normalized[idx].is_correct = True
                current_correct.append(idx)
                if len(current_correct) == correct_count:
                    break
    elif len(current_correct) > correct_count:
        keep = set(current_correct[:correct_count])
        for idx, option in enumerate(normalized):
            option.is_correct = idx in keep

    return [
        HomeworkOptionOut(
            label=option.label,
            text=option.text,
            is_correct=option.is_correct,
        )
        for option in normalized
    ]


def _normalize_criteria(criteria: list[str]) -> list[str]:
    cleaned = [criterion.strip() for criterion in criteria if criterion and criterion.strip()]
    if cleaned:
        return cleaned[:5]
    return [
        "Identifies the key concept from the chapter accurately.",
        "Uses terminology from the chapter correctly.",
        "Explains the reasoning clearly and in a structured way.",
    ]


def _fallback_prompt(question_type: Literal["mcq", "open"], index: int) -> str:
    if question_type == "mcq":
        return f"Which statement best reflects a central concept from the chapter? (Question {index + 1})"
    return f"Explain one important concept from the chapter and support your answer with details from the text. (Question {index + 1})"
