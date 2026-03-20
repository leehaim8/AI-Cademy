from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from typing import Optional

from openai import OpenAI
from pydantic import BaseModel, Field, conint


@dataclass
class Topic:
    id: int
    name: str
    prereqs: set[int] = field(default_factory=set)
    dependents: set[int] = field(default_factory=set)
    difficulty: float = 1.0


@dataclass
class LessonUnit:
    week_index: int
    topic_ids: list[int]


@dataclass
class CourseConfig:
    num_weeks: int = 14
    hours_per_week: int = 3
    max_topics_per_week: int = 2
    max_prereqs_per_topic: int = 4


@dataclass
class ConsolidatedWeek:
    central_topic: str
    main_subjects: list[str]


class Edge(BaseModel):
    prereq: str
    dependent: str
    confidence: conint(ge=1, le=5)
    rationale: str


class PrereqGraph(BaseModel):
    edges: list[Edge]


class WeekCluster(BaseModel):
    central_topic: str
    main_subjects: list[str]


class ConsolidatedSyllabus(BaseModel):
    weeks: list[WeekCluster]


def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured for the syllabus agent.")
    return OpenAI(api_key=api_key)


class FlowCreatorOpenAIAgent:
    def __init__(self, config: CourseConfig, model: Optional[str] = None):
        self.config = config
        self.client = get_openai_client()
        self.model = model or os.getenv("SYLLABUS_AGENT_MODEL", "gpt-4o-mini")
        self.topics: list[Topic] = []

    def add_topics(self, topic_names: list[str]) -> None:
        seen: set[str] = set()
        normalized_topics: list[str] = []
        for topic in topic_names:
            cleaned = topic.strip()
            if not cleaned:
                continue
            lowered = cleaned.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized_topics.append(cleaned)
        self.topics = [Topic(id=index, name=name) for index, name in enumerate(normalized_topics)]

    def build_syllabus(
        self,
        audience: str,
        constraints: Optional[str] = None,
    ) -> list[LessonUnit]:
        if not self.topics:
            return []

        graph = self._infer_prereq_graph(audience, constraints)
        self._apply_graph(graph)
        order = self._topological_sort()
        self._compute_difficulty()
        return self._schedule_weeks(order)

    def _infer_prereq_graph(
        self,
        audience: str,
        constraints: Optional[str],
    ) -> PrereqGraph:
        topic_list = "\n".join(f"- {topic.name}" for topic in self.topics)

        system = """
You are a senior university lecturer.
Infer a minimal prerequisite graph between course topics.
Focus on conceptual necessity, not teaching convenience.
"""

        user = f"""
Audience: {audience}

Topics (unordered):
{topic_list}

Constraints:
{constraints or "None"}

Rules:
- Use topic names verbatim
- Avoid cycles
- Prefer minimal edges
"""

        response = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system.strip()},
                {"role": "user", "content": user.strip()},
            ],
            text_format=PrereqGraph,
        )

        return response.output_parsed

    def _apply_graph(self, graph: PrereqGraph) -> None:
        name_to_id = {topic.name: topic.id for topic in self.topics}
        grouped: dict[str, list[Edge]] = {}

        for edge in graph.edges:
            if edge.prereq in name_to_id and edge.dependent in name_to_id:
                grouped.setdefault(edge.dependent, []).append(edge)

        for dependent_name, edges in grouped.items():
            dep_id = name_to_id[dependent_name]
            for edge in sorted(edges, key=lambda item: item.confidence, reverse=True)[
                : self.config.max_prereqs_per_topic
            ]:
                prereq_id = name_to_id[edge.prereq]
                self.topics[dep_id].prereqs.add(prereq_id)
                self.topics[prereq_id].dependents.add(dep_id)

    def _topological_sort(self) -> list[int]:
        prereq_copy = {topic.id: set(topic.prereqs) for topic in self.topics}
        ordered: list[int] = []
        ready = [topic_id for topic_id, prereqs in prereq_copy.items() if not prereqs]

        while ready:
            current = ready.pop(0)
            ordered.append(current)
            for topic in self.topics:
                if current in prereq_copy[topic.id]:
                    prereq_copy[topic.id].remove(current)
                    if not prereq_copy[topic.id]:
                        ready.append(topic.id)

        remaining = [topic.id for topic in self.topics if topic.id not in ordered]
        ordered.extend(remaining)
        return ordered

    def _compute_difficulty(self) -> None:
        for topic in self.topics:
            topic.difficulty = 1.0 + math.log(1 + len(topic.prereqs) + len(topic.dependents), 2)

    def _schedule_weeks(self, ordered_ids: list[int]) -> list[LessonUnit]:
        if not ordered_ids:
            return []

        total_difficulty = sum(self.topics[topic_id].difficulty for topic_id in ordered_ids)
        avg_difficulty = total_difficulty / self.config.num_weeks

        weeks: list[LessonUnit] = []
        current_topics: list[int] = []
        current_load = 0.0

        for topic_id in ordered_ids:
            difficulty = self.topics[topic_id].difficulty
            if current_topics and (
                current_load + difficulty > 1.4 * avg_difficulty
                or len(current_topics) >= self.config.max_topics_per_week
            ):
                weeks.append(LessonUnit(week_index=len(weeks) + 1, topic_ids=current_topics))
                current_topics = [topic_id]
                current_load = difficulty
            else:
                current_topics.append(topic_id)
                current_load += difficulty

        if current_topics:
            weeks.append(LessonUnit(week_index=len(weeks) + 1, topic_ids=current_topics))

        return weeks


class WeeklyConsolidationAgent:
    def __init__(self, model: Optional[str] = None):
        self.client = get_openai_client()
        self.model = model or os.getenv("SYLLABUS_AGENT_MODEL", "gpt-4o-mini")

    def consolidate(
        self,
        audience: str,
        main_subjects: list[str],
        target_weeks: int,
        constraints: Optional[str] = None,
    ) -> ConsolidatedSyllabus:
        subjects_text = "\n".join(f"- {topic}" for topic in main_subjects)

        system = """
You are a senior lecturer creating a practical course syllabus.
Group related main subjects into weekly clusters.
"""

        user = f"""
Audience: {audience}
Constraints: {constraints or "None"}

Main subjects:
{subjects_text}

Tasks:
1. Return exactly {target_weeks} weeks
2. Each week must include:
   - central_topic: one concise theme that unifies that week
   - main_subjects: a list of related main subjects
3. Use only the provided main subjects (no new ones)
4. Cover all main subjects exactly once
"""

        response = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system.strip()},
                {"role": "user", "content": user.strip()},
            ],
            text_format=ConsolidatedSyllabus,
        )

        return response.output_parsed


def _strip_week_prefix(value: str) -> str:
    return re.sub(r"^\s*Week\s+\d+\s*:\s*", "", value, flags=re.IGNORECASE).strip()


def normalize_consolidated_weeks(
    raw_weeks: list[WeekCluster],
    target_weeks: int,
    allowed_topics: list[str],
) -> list[ConsolidatedWeek]:
    allowed_set = set(allowed_topics)
    used: set[str] = set()
    initial: list[ConsolidatedWeek] = []

    for week in raw_weeks:
        cleaned_subjects: list[str] = []
        for topic in week.main_subjects:
            clean = _strip_week_prefix(topic)
            if clean in allowed_set and clean not in used:
                used.add(clean)
                cleaned_subjects.append(clean)
        if cleaned_subjects:
            center = week.central_topic.strip() or cleaned_subjects[0]
            initial.append(ConsolidatedWeek(central_topic=center, main_subjects=cleaned_subjects))

    buckets: list[list[str]] = [[] for _ in range(target_weeks)]
    central_topics = ["" for _ in range(target_weeks)]

    for index, week in enumerate(initial):
        bucket_index = index % target_weeks
        if not central_topics[bucket_index]:
            central_topics[bucket_index] = week.central_topic
        buckets[bucket_index].extend(week.main_subjects)

    for topic in allowed_topics:
        if topic in used:
            continue
        smallest_bucket = min(range(target_weeks), key=lambda idx: len(buckets[idx]))
        buckets[smallest_bucket].append(topic)

    normalized: list[ConsolidatedWeek] = []
    for index in range(target_weeks):
        deduped: list[str] = []
        seen: set[str] = set()
        for topic in buckets[index]:
            if topic in seen:
                continue
            seen.add(topic)
            deduped.append(topic)

        central_topic = central_topics[index] or (
            deduped[0] if deduped else f"Week {index + 1} Theme"
        )
        normalized.append(
            ConsolidatedWeek(
                central_topic=central_topic,
                main_subjects=deduped,
            )
        )

    return normalized


def generate_syllabus(
    topics: list[str],
    num_weeks: int,
    audience: str,
    constraints: Optional[str] = None,
) -> list[dict[str, object]]:
    cleaned_topics = [topic.strip() for topic in topics if topic.strip()]
    if not cleaned_topics:
        return []

    config = CourseConfig(num_weeks=num_weeks)
    planner = FlowCreatorOpenAIAgent(config)
    planner.add_topics(cleaned_topics)

    weeks = planner.build_syllabus(audience=audience, constraints=constraints)
    ordered_subjects = [planner.topics[topic_id].name for week in weeks for topic_id in week.topic_ids]
    unique_ordered_subjects = list(dict.fromkeys(ordered_subjects))

    consolidator = WeeklyConsolidationAgent()
    consolidated = consolidator.consolidate(
        audience=audience,
        main_subjects=unique_ordered_subjects,
        target_weeks=num_weeks,
        constraints=constraints,
    )
    final_weeks = normalize_consolidated_weeks(
        consolidated.weeks,
        num_weeks,
        unique_ordered_subjects,
    )

    return [
        {
            "week": index + 1,
            "central_topic": week.central_topic,
            "topics": week.main_subjects,
        }
        for index, week in enumerate(final_weeks)
    ]
