from __future__ import annotations

import importlib.util
import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any


DEFAULT_CODE_REVIEW_AGENT_DIR = Path(
    os.getenv(
        "CODE_REVIEW_AGENT_DIR",
        r"C:\Users\omerg\Desktop\FinalProject\code_review_agent",
    )
)


def _load_module(module_name: str, file_path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module from {file_path}.")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@lru_cache(maxsize=1)
def load_external_code_review_modules() -> tuple[Any, Any, Any]:
    base_dir = DEFAULT_CODE_REVIEW_AGENT_DIR
    required_files = {
        "prompts": base_dir / "prompts.py",
        "openai_client": base_dir / "openai_client.py",
        "agent": base_dir / "agent.py",
    }

    if not base_dir.exists():
        raise ValueError(
            "The external code review agent directory was not found. "
            f"Expected: {base_dir}"
        )

    missing = [str(path) for path in required_files.values() if not path.exists()]
    if missing:
        raise ValueError(
            "The external code review agent is missing required files: "
            + ", ".join(missing)
        )

    prompts_module = _load_module("prompts", required_files["prompts"])
    openai_client_module = _load_module(
        "openai_client", required_files["openai_client"]
    )
    agent_module = _load_module("agent", required_files["agent"])
    return prompts_module, agent_module, openai_client_module


def get_teaching_code_review_agent() -> tuple[Any, Any]:
    _, agent_module, openai_client_module = load_external_code_review_modules()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured for the code review agent.")

    model = os.getenv("CODE_REVIEW_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4.1-mini"
    llm = openai_client_module.OpenAIClient(api_key=api_key, model=model)
    return agent_module.TeachingCodeReviewAgent(llm), agent_module


def get_code_review_options() -> dict[str, list[str]]:
    prompts_module, _, _ = load_external_code_review_modules()
    return {
        "languages": list(prompts_module.LANGUAGE_OPTIONS),
        "difficulty_levels": list(prompts_module.DIFFICULTY_OPTIONS),
    }


def run_generated_code_review(*, language: str, difficulty_level: str) -> dict[str, Any]:
    agent, _ = get_teaching_code_review_agent()
    specification = agent.build_specification(
        language=language,
        difficulty_level=difficulty_level,
    )
    result = agent.run(specification)

    return {
        "source": "generated_sample",
        "specification": result.specification.to_dict(),
        "exercise_description": result.exercise_description,
        "generated_sample_solution": result.generated_sample_solution,
        "pedagogical_review": result.pedagogical_review,
    }


def review_submitted_code(
    *,
    language: str,
    difficulty_level: str,
    code: str,
    exercise_description: str | None = None,
) -> dict[str, Any]:
    agent, agent_module = get_teaching_code_review_agent()
    normalized_code = code.strip()
    if not normalized_code:
        raise ValueError("code is required when reviewing a submitted solution.")

    specification = agent.build_specification(
        language=language,
        difficulty_level=difficulty_level,
    )
    resolved_exercise_description = _resolve_exercise_description(
        specification=specification,
        exercise_description=exercise_description,
    )
    example = agent_module.StudentLikeExample(
        specification=specification,
        exercise_description=resolved_exercise_description,
        code=normalized_code,
    )
    review = agent.perform_pedagogical_review(example)

    return {
        "source": "submitted_code",
        "specification": specification.to_dict(),
        "exercise_description": resolved_exercise_description,
        "generated_sample_solution": normalized_code,
        "pedagogical_review": review,
    }


def _resolve_exercise_description(*, specification: Any, exercise_description: str | None) -> str:
    if exercise_description and exercise_description.strip():
        return exercise_description.strip()

    return (
        f"Review a {specification.difficulty_level.lower()} {specification.language} "
        f"learner solution focused on {specification.topic}."
    )
