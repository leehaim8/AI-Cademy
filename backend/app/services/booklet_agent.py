from __future__ import annotations

import json
import logging
import os
import re
from io import BytesIO
from typing import Any

from docx import Document
from openai import OpenAI
from PyPDF2 import PdfReader


logger = logging.getLogger(__name__)


COURSE_MAP_MODEL = os.getenv("BOOKLET_COURSE_MAP_MODEL") or os.getenv(
    "COURSE_MAP_MODEL", "gpt-4.1"
)
CHAPTER_MODEL = os.getenv("BOOKLET_CHAPTER_MODEL") or os.getenv(
    "CHAPTER_MODEL", "gpt-4.1"
)
ALIGN_MODEL = os.getenv("BOOKLET_ALIGN_MODEL") or CHAPTER_MODEL


COURSE_FLOW_SYSTEM_PROMPT = (
    "You are analyzing a university course syllabus structured by weeks.\n\n"
    "Return ONLY valid JSON.\n"
    "Do not include explanations.\n"
    "Do not include Markdown.\n"
    "Do not include backticks.\n"
    "Return a single JSON object only."
)

COURSE_FLOW_SCHEMA_TEMPLATE = """{
  "course_phases": [
    {
      "phase_name": "string",
      "description": "string",
      "weeks": [int]
    }
  ],
  "weeks": [
    {
      "week_number": int,
      "central_topic": "string",
      "subtopics": ["string"]
    }
  ],
  "dependencies": [
    {
      "from_week": int,
      "to_week": int,
      "type": "prerequisite | builds_on | extends"
    }
  ]
}"""


CHAPTER_SYSTEM_PROMPT = (
    "You are writing a university-level textbook chapter. "
    "You understand the full structure of the course. "
    "Write this chapter in academic depth. "
    "Expand significantly. "
    "Explain rigorously. "
    "Connect to earlier topics. "
    "Prepare ground for later topics. "
    "Do not summarize. "
    "Do not output JSON. "
    "Preserve full theoretical depth and academic rigor. "
    "Do not remove or rewrite core academic content; examples are additive only."
)


def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured for the booklet agent.")
    return OpenAI(api_key=api_key)


def extract_text_from_upload(filename: str, content: bytes) -> str:
    lower_name = filename.lower()

    if lower_name.endswith(".pdf"):
        reader = PdfReader(BytesIO(content))
        chunks = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                chunks.append(page_text)
        return "\n\n".join(chunks)

    if lower_name.endswith(".docx"):
        doc = Document(BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

    if lower_name.endswith((".txt", ".md")):
        return content.decode("utf-8", errors="ignore")

    return content.decode("utf-8", errors="ignore")


def syllabus_text_from_weeks(weeks: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for entry in weeks:
        week_num = entry.get("week") or entry.get("week_number")
        central_topic = entry.get("central_topic", "").strip()
        topics = entry.get("topics") or entry.get("subtopics") or []
        if week_num is None:
            continue
        header = f"Week {week_num}: Central Topic: {central_topic}".strip()
        lines.append(header)
        for topic in topics:
            if topic:
                lines.append(f"- {topic}")
        lines.append("")
    return "\n".join(lines).strip()


def parse_weekly_structure(syllabus_text: str) -> dict[str, Any]:
    lines = [line.rstrip() for line in syllabus_text.splitlines()]
    weeks: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    week_re = re.compile(r"^\s*Week\s+(\d+)\s*[:\-]?\s*(.*)$", re.IGNORECASE)
    table_week_re = re.compile(r"^\s*(\d{1,2})\s+(.+)$")
    central_re = re.compile(
        r"^\s*(Central\s*Topic|Main\s*Topic|Topic)\s*:\s*(.+)$",
        re.IGNORECASE,
    )
    bullet_re = re.compile(r"^\s*[-\u2022\*]\s+(.+)$")
    numbered_re = re.compile(r"^\s*\d+\s*[\.\)]\s+(.+)$")
    header_re = re.compile(r"\bWeek\s+Theme\s+Topics\b", re.IGNORECASE)
    course_structure_re = re.compile(r"^Course\s+Structure", re.IGNORECASE)
    table_mode = False

    for raw in lines:
        line = re.sub(r"\s+", " ", raw).strip()
        line = re.sub(r"([a-z])([A-Z])", r"\1 \2", line)
        if not line:
            continue

        if header_re.search(line):
            table_mode = True
            continue
        if course_structure_re.search(line):
            # Keep table mode if already enabled.
            continue

        week_match = week_re.match(line)
        if week_match:
            if current:
                weeks.append(current)
            current = {
                "week_number": int(week_match.group(1)),
                "central_topic": "",
                "subtopics": [],
            }
            trailing = week_match.group(2).strip()
            if trailing:
                central_inline = central_re.match(trailing)
                if central_inline:
                    current["central_topic"] = central_inline.group(2).strip()
            continue

        if table_mode:
            table_match = table_week_re.match(line)
            if table_match:
                if current:
                    weeks.append(current)
                current = {
                    "week_number": int(table_match.group(1)),
                    "central_topic": table_match.group(2).strip(),
                    "subtopics": [],
                }
                continue

            if current is None:
                continue

            if header_re.search(line):
                continue

            if line:
                current["subtopics"].append(line)
            continue

        if current is None:
            continue

        central_match = central_re.match(line)
        if central_match:
            current["central_topic"] = central_match.group(2).strip()
            continue

        bullet_match = bullet_re.match(line)
        if bullet_match:
            current["subtopics"].append(bullet_match.group(1).strip())
            continue
        numbered_match = numbered_re.match(line)
        if numbered_match:
            current["subtopics"].append(numbered_match.group(1).strip())
            continue

    if current:
        weeks.append(current)

    return {"weeks": weeks}


def build_course_map(syllabus_text: str, client: OpenAI) -> dict[str, Any]:
    structured = parse_weekly_structure(syllabus_text)
    if not structured["weeks"]:
        raise ValueError(
            "Failed to detect weekly structure. "
            "Make sure the syllabus has lines like 'Week 1: Central Topic: ...' "
            "and bullet subtopics."
        )
    prompt = (
        "Use the structured weekly syllabus below. Return a JSON object that matches this schema exactly:\n\n"
        f"{COURSE_FLOW_SCHEMA_TEMPLATE}\n\n"
        "If you cannot infer phases or dependencies, return empty arrays for them.\n\n"
        f"Structured weekly syllabus (authoritative):\n{json.dumps(structured, ensure_ascii=False, indent=2)}\n\n"
        f"Raw syllabus text (context only):\n{syllabus_text}"
    )

    response = client.responses.create(
        model=COURSE_MAP_MODEL,
        input=[
            {"role": "system", "content": COURSE_FLOW_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_output_tokens=3000,
    )
    text = _extract_response_text(response)
    if not text:
        raise RuntimeError("LLM returned empty response.")
    data = _safe_json_loads(text)
    if not isinstance(data, dict):
        raise RuntimeError("Course map is not a JSON object.")
    return data


def build_outline_from_course_map(course_map: dict[str, Any]) -> list[dict[str, Any]]:
    outline: list[dict[str, Any]] = []
    weeks = course_map.get("weeks") or []
    for week in weeks:
        try:
            week_num = week.get("week_number")
            title = week.get("central_topic") or "Untitled"
            topics = week.get("subtopics") or []
        except AttributeError:
            continue
        label = f"Week {week_num}: {title}" if week_num else title
        outline.append({"title": label, "topics": topics})
    return outline


def generate_chapter(
    chapter_name: str,
    course_map: dict[str, Any],
    client: OpenAI,
    output_language: str,
    tone: str,
    max_output_tokens: int = 6000,
) -> str:
    payload = _build_chapter_prompt(chapter_name, course_map, output_language, tone)
    response = client.responses.create(
        model=CHAPTER_MODEL,
        input=[
            {"role": "system", "content": CHAPTER_SYSTEM_PROMPT},
            {"role": "user", "content": payload},
        ],
        max_output_tokens=max_output_tokens,
    )
    text = _extract_response_text(response).strip()
    if not text:
        raise RuntimeError("Empty chapter output.")
    return text


def align_chapter(
    chapter_name: str,
    chapter_text: str,
    course_map: dict[str, Any],
    client: OpenAI,
    output_language: str,
    tone: str,
    max_output_tokens: int = 4000,
) -> str:
    prompt = (
        "You are the academic alignment pass for a textbook chapter.\n\n"
        f"Chapter: {chapter_name}\n"
        f"Output language: {output_language}\n"
        f"Tone: {tone}\n\n"
        "Task:\n"
        "1) Ensure the chapter aligns with the provided course map and stays within the selected chapter scope.\n"
        "2) Ensure every major section includes three real-world examples (Easy, Intermediate, Advanced/Challenging).\n"
        "3) Ensure the chapter ends with the sections 'Glossary and Concept Map' and 'Academic and Technical Sources'.\n"
        "4) If anything is missing, add it. Do not remove substantive content.\n"
        "5) Return the full chapter as clean Markdown only.\n\n"
        "Course map (context):\n"
        f"{json.dumps(course_map, ensure_ascii=False, indent=2)}\n\n"
        "Draft chapter:\n"
        f"{chapter_text}"
    )

    response = client.responses.create(
        model=ALIGN_MODEL,
        input=[
            {"role": "system", "content": CHAPTER_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_output_tokens=max_output_tokens,
    )
    text = _extract_response_text(response).strip()
    return text or chapter_text


def _build_chapter_prompt(
    chapter_name: str,
    course_map: dict[str, Any],
    output_language: str,
    tone: str,
) -> str:
    course_map_json = json.dumps(course_map, ensure_ascii=False, indent=2)
    return (
        "You are provided the internal course map for context. "
        "Use it to place the requested chapter within the course flow.\n\n"
        f"Requested chapter: {chapter_name}\n"
        f"Output language: {output_language}\n"
        f"Tone: {tone}\n\n"
        "Internal course map (context only, do not output this):\n"
        f"{course_map_json}\n\n"
        "Before writing the chapter:\n"
        "1) Identify the chapter's syllabus topics and ensure coverage of all major items.\n"
        "2) Determine the appropriate depth level based on the syllabus content itself (not the week number).\n\n"
        "Adaptive Depth Strategy:\n"
        "- Level 1 (Elementary): intuitive explanations, no formal mathematics, no advanced internals, conceptual clarity.\n"
        "- Level 2 (Conceptual-Technical): technical mechanisms clearly explained, engineering trade-offs, medium detail.\n"
        "- Level 3 (Analytical): quantitative reasoning allowed, performance modeling allowed, structured technical analysis.\n"
        "- Level 4 (Advanced): formal reasoning, architecture-level trade-offs, deep implementation considerations.\n\n"
        "Important constraints:\n"
        "- Do NOT introduce topics that belong to future weeks.\n"
        "- If material belongs to later weeks, reduce it to a conceptual reference only.\n"
        "- Maintain continuity with previous chapters.\n\n"
        "Write the chapter in clean academic Markdown with clear section headers. "
        "Include definitions, explanations, and transitions. "
        "Reference earlier course concepts naturally and prepare for later topics. "
        "If you include a conclusion, it must summarize only the selected chapter.\n\n"
        "Examples rule (global):\n"
        "- For every major concept or technical aspect, keep the full theoretical explanation intact.\n"
        "- Do NOT remove, shorten, or rewrite the academic content. Add examples after it.\n"
        "- After each major concept explanation, append an example set in this exact format:\n"
        "  Example Set:\n"
        "  - Easy Example:\n"
        "  - Medium Example:\n"
        "  - Advanced / Challenging Example:\n"
        "- Provide exactly three examples (Easy, Medium, Advanced/Challenging) per concept.\n"
        "- Examples must be meaningful, real-world engineering contexts.\n\n"
        "Per-section examples (required):\n"
        "- For each major section, include three real-world examples labeled Easy, Intermediate, Advanced/Challenging.\n"
        "- Examples must be realistic, technically coherent, and directly tied to the section's concepts.\n\n"
        "At the end of the chapter, include the following two sections:\n"
        "1) Glossary and Concept Map\n"
        "- Provide a structured list of key concepts introduced in this chapter only.\n"
        "- For each concept include: a concise definition (2-4 lines), the section where it was introduced, "
        "and if relevant a reference to earlier chapters (for example: 'Builds on Chapter 2 - Architecture').\n"
        "- Avoid generic filler terminology.\n"
        "2) Academic and Technical Sources\n"
        "- Provide first-tier academic and technical sources directly relevant to this chapter.\n"
        "- Acceptable sources: peer-reviewed papers, official standards (IETF RFCs, IEEE, ISO, ITU), authoritative textbooks.\n"
        "- For each reference include: full citation, source type, a concise summary, and an explanation of its impact.\n\n"
        "Preservation rule:\n"
        "- Do not shorten the chapter significantly or remove important technical insight.\n"
        "- Do not change the writing tone or restructure unless required for compliance."
    )


def _safe_json_loads(text: str) -> Any:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        logger.error("Course map JSON parse failed. Raw response:\n%s", text)
        raise RuntimeError("Invalid JSON from LLM.") from None


def _extract_response_text(response: Any) -> str:
    text = getattr(response, "output_text", None)
    if isinstance(text, str) and text.strip():
        return text

    output = getattr(response, "output", None) or []
    for item in output:
        content = getattr(item, "content", None) or []
        for part in content:
            if isinstance(part, dict):
                if part.get("text"):
                    return str(part["text"])
                if part.get("json"):
                    return json.dumps(part["json"], ensure_ascii=False)
                continue
            part_type = getattr(part, "type", None)
            if part_type == "output_json":
                val = getattr(part, "json", None)
                if isinstance(val, dict):
                    return json.dumps(val, ensure_ascii=False)
            for key in ("text", "json", "output_text"):
                val = getattr(part, key, None)
                if isinstance(val, str) and val.strip():
                    return val
                if isinstance(val, dict):
                    return json.dumps(val, ensure_ascii=False)
    return ""
