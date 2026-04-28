from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from typing import Any

from openai import OpenAI

OPENAI_MODEL_CHAT = os.getenv("HOMEWORK_CHECKER_MODEL_CHAT", "gpt-4o-mini")
OPENAI_MODEL_EMBED = os.getenv("HOMEWORK_CHECKER_MODEL_EMBED", "text-embedding-3-small")

SEMANTIC_FULLY_MET_THRESHOLD = 0.65
SEMANTIC_PARTIAL_THRESHOLD = 0.30
CONCEPT_WEIGHT = 0.70
SEMANTIC_WEIGHT = 0.30


@dataclass
class RubricItem:
    id: str
    question_id: str
    description: str
    points: float


@dataclass
class Rubric:
    assignment_id: str
    items: list[RubricItem] = field(default_factory=list)


@dataclass
class Question:
    id: str
    assignment_id: str
    raw_text: str
    points: float = 0.0
    expected_concepts: list[str] = field(default_factory=list)
    grading_criteria: list[str] = field(default_factory=list)
    options: list[dict[str, Any]] = field(default_factory=list)
    correct_option_labels: list[str] = field(default_factory=list)
    expected_answer_type: str = "open"


@dataclass
class Assignment:
    id: str
    title: str
    raw_text: str
    questions: list[Question]
    rubric: Rubric


@dataclass
class AnswerSegment:
    question_id: str
    raw_text: str
    extracted_concepts: list[str] = field(default_factory=list)
    embedding: list[float] | None = None


@dataclass
class SubmissionAnalysis:
    segmented_answers: list[AnswerSegment]
    extracted_concepts: list[str] = field(default_factory=list)


@dataclass
class Submission:
    id: str
    assignment_id: str
    student_id: str
    answer_text: str
    analysis: SubmissionAnalysis | None = None


@dataclass
class Requirement:
    id: str
    question_id: str
    description: str
    expected_concepts: list[str]
    points: float
    grading_criteria: list[str] = field(default_factory=list)
    correct_option_labels: list[str] = field(default_factory=list)
    type: str = "conceptual"


@dataclass
class RequirementEvaluationResult:
    rubric_item_id: str
    question_id: str
    status: str
    score: float
    feedback: str = ""
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass
class GradingResult:
    submission_id: str
    total_score: float
    per_question_scores: dict[str, float]
    per_requirement_results: list[RequirementEvaluationResult]
    overall_feedback: str


def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured for the homework checker.")
    return OpenAI(api_key=api_key)


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


def clean_feedback_text(text: str) -> str:
    cleaned = re.sub(r"^\s*feedback\s*:\s*", "", text, flags=re.IGNORECASE)
    return cleaned.strip()


class OpenAIHomeworkHelper:
    def __init__(self, client: OpenAI):
        self.client = client

    def get_embedding(self, text: str) -> list[float]:
        response = self.client.embeddings.create(
            model=OPENAI_MODEL_EMBED,
            input=text,
        )
        return response.data[0].embedding

    def chat_completion(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=OPENAI_MODEL_CHAT,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        content = response.choices[0].message.content
        return content.strip() if content else ""


class AssignmentUnderstandingLayer:
    def __init__(self, helper: OpenAIHomeworkHelper):
        self.helper = helper

    @staticmethod
    def _parse_manual_rubric_groups(rubric_text: str) -> list[list[str]]:
        groups: list[list[str]] = []
        current_group: list[str] = []

        for raw_line in rubric_text.split("\n"):
            line = raw_line.strip()
            if not line:
                continue

            if re.match(r"(?i)^question\s+\d+\s*$", line) or re.match(r"(?i)^q\s*\d+\s*$", line):
                if current_group:
                    groups.append(current_group)
                    current_group = []
                continue

            if line.startswith("-") or line.startswith("*"):
                current_group.append(line.lstrip("-* ").strip())
                continue

            if current_group:
                current_group.append(line)

        if current_group:
            groups.append(current_group)

        return groups

    def parse_questions(self, assignment_id: str, questions_text: str) -> list[Question]:
        lines = [line.strip() for line in questions_text.split("\n") if line.strip()]
        return [
            Question(
                id=f"Q{index}",
                assignment_id=assignment_id,
                raw_text=line,
                points=0.0,
            )
            for index, line in enumerate(lines, start=1)
        ]

    def _parse_structured_questions(self, assignment_id: str, structured_questions: list) -> list[Question]:
        questions: list[Question] = []
        for index, q_data in enumerate(structured_questions, start=1):
            # Handle both dict and object attributes
            if hasattr(q_data, 'points'):
                points = float(q_data.points)
                prompt = q_data.prompt
                grading_criteria = list(q_data.grading_criteria or [])
                answer_type = getattr(q_data, 'type', 'open')
                options = [option.model_dump() if hasattr(option, 'model_dump') else dict(option) for option in getattr(q_data, 'options', [])]
            else:
                points = float(q_data.get("points", 0.0))
                prompt = q_data.get("prompt", "")
                grading_criteria = list(q_data.get("grading_criteria", []))
                answer_type = q_data.get("type", "open")
                options = list(q_data.get("options", []))

            correct_option_labels = [
                str(option.get("label", "")).strip().upper()
                for option in options
                if option.get("is_correct")
            ]
            
            questions.append(
                Question(
                    id=f"Q{index}",
                    assignment_id=assignment_id,
                    raw_text=prompt,
                    points=points,
                    grading_criteria=grading_criteria,
                    options=options,
                    correct_option_labels=correct_option_labels,
                    expected_answer_type=answer_type,
                )
            )
        return questions

    def parse_rubric(
        self,
        assignment_id: str,
        rubric_text: str,
        questions: list[Question],
        structured_questions: list | None = None,
    ) -> Rubric:
        if structured_questions:
            items: list[RubricItem] = []
            for index, question in enumerate(questions, start=1):
                description = "; ".join(question.grading_criteria) if question.grading_criteria else question.raw_text
                items.append(
                    RubricItem(
                        id=f"R{index}",
                        question_id=question.id,
                        description=description,
                        points=question.points,
                    )
                )
            return Rubric(assignment_id=assignment_id, items=items)

        manual_groups = self._parse_manual_rubric_groups(rubric_text)
        if manual_groups:
            items: list[RubricItem] = []
            for index, question in enumerate(questions, start=1):
                criteria = manual_groups[index - 1] if index - 1 < len(manual_groups) else []
                if criteria:
                    question.grading_criteria = criteria
                description = "\n".join(criteria) if criteria else question.raw_text
                items.append(
                    RubricItem(
                        id=f"R{index}",
                        question_id=question.id,
                        description=description,
                        points=question.points,
                    )
                )
            return Rubric(assignment_id=assignment_id, items=items)

        lines = [line.strip() for line in rubric_text.split("\n") if line.strip()]
        items: list[RubricItem] = []
        count = max(len(lines), len(questions))

        if count == 0:
            return Rubric(assignment_id=assignment_id, items=[])

        for index in range(count):
            description = lines[index] if index < len(lines) else f"General criterion for question {index + 1}"
            question = questions[index] if index < len(questions) else questions[-1]
            items.append(
                RubricItem(
                    id=f"R{index + 1}",
                    question_id=question.id,
                    description=description,
                    points=question.points,
                )
            )

        return Rubric(assignment_id=assignment_id, items=items)

    def enrich_questions_with_concepts(self, questions: list[Question]) -> None:
        for question in questions:
            prompt = (
                "You are given the wording of a homework question.\n"
                "Return a list of key concepts as a comma-separated list.\n"
                "Use short concept phrases only.\n\n"
                f"Question: {question.raw_text}"
            )
            response = self.helper.chat_completion(
                "You are an academic assistant that extracts key concepts from questions.",
                prompt,
            )
            question.expected_concepts = [
                concept.strip()
                for concept in response.split(",")
                if concept.strip()
            ]

    def build_requirements(self, assignment: Assignment) -> list[Requirement]:
        requirements: list[Requirement] = []
        for index, item in enumerate(assignment.rubric.items, start=1):
            question = next(
                question for question in assignment.questions if question.id == item.question_id
            )
            requirements.append(
                Requirement(
                    id=f"REQ{index}",
                    question_id=question.id,
                    description=item.description,
                    expected_concepts=question.expected_concepts,
                    points=item.points,
                    grading_criteria=question.grading_criteria,
                    correct_option_labels=question.correct_option_labels,
                    type=question.expected_answer_type,
                )
            )
        return requirements

    def build_assignment(
        self,
        assignment_id: str,
        title: str,
        assignment_text: str,
        questions_text: str,
        rubric_text: str,
        structured_questions: list | None = None,
    ) -> tuple[Assignment, list[Requirement]]:
        if structured_questions:
            questions = self._parse_structured_questions(assignment_id, structured_questions)
        else:
            questions = self.parse_questions(assignment_id, questions_text)

        rubric = self.parse_rubric(assignment_id, rubric_text, questions, structured_questions)
        self.enrich_questions_with_concepts(questions)
        assignment = Assignment(
            id=assignment_id,
            title=title,
            raw_text=assignment_text,
            questions=questions,
            rubric=rubric,
        )
        return assignment, self.build_requirements(assignment)


class SubmissionUnderstandingLayer:
    def __init__(self, helper: OpenAIHomeworkHelper):
        self.helper = helper

    @staticmethod
    def _extract_question_number(question_id: str) -> str | None:
        match = re.search(r"(\d+)", question_id)
        return match.group(1) if match else None

    @staticmethod
    def _tokenize_answer(text: str) -> set[str]:
        return {token for token in MatchingEngine._tokenize(text)}

    @staticmethod
    def _extract_selected_labels(answer_text: str) -> list[str]:
        labels: list[str] = []
        patterns = [
            r"(?im)\b([A-H])\s*[:\).\-]",
            r"(?i)\boption\s+([A-H])\b",
            r"(?i)\banswer\s*[:\-]?\s*([A-H])\b",
        ]
        for pattern in patterns:
            matches = re.findall(pattern, answer_text)
            for match in matches:
                label = match.strip().upper()
                if label and label not in labels:
                    labels.append(label)
            if labels:
                break
        return labels

    @staticmethod
    def _criterion_keywords(criterion: str) -> list[str]:
        tokens = MatchingEngine._tokenize(criterion)
        stop_words = {
            "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
            "student", "question", "answer", "should", "would", "could", "at", "least", "two",
            "one", "more", "than", "such", "as", "like", "be", "is", "are", "was", "were",
            "of", "to", "in", "on", "by", "an", "a", "or", "it", "its", "their", "how",
            "what", "which", "both", "also", "include", "includes", "provided", "provide",
            "mention", "mentioning", "list", "give", "provide", "explain", "describe",
        }
        return [token for token in tokens if token not in stop_words]

    def _criterion_met(self, criterion: str, answer_text: str, answer_tokens: set[str]) -> bool:
        lower_answer = answer_text.lower()
        lower_criterion = criterion.lower()

        if lower_criterion in lower_answer:
            return True

        keywords = self._criterion_keywords(criterion)
        if not keywords:
            return False

        matched = sum(1 for keyword in keywords if keyword in answer_tokens)
        ratio = matched / len(keywords)

        if "at least two benefits" in lower_criterion:
            benefit_markers = [
                "simplified",
                "simplify",
                "portable",
                "portability",
                "protection",
                "fault",
                "multitasking",
                "isolation",
                "safety",
                "efficiency",
                "resource",
            ]
            marker_count = sum(1 for marker in benefit_markers if marker in lower_answer)
            return marker_count >= 2

        if "example" in lower_criterion:
            return any(marker in lower_answer for marker in ("virtual memory", "process isolation", "example"))

        return ratio >= 0.6

    def _score_open_response(self, requirement: Requirement, answer: AnswerSegment) -> tuple[str, float, dict[str, Any]]:
        if not requirement.grading_criteria:
            return "NOT_MET", 0.0, {"matched_criteria": [], "missing_criteria": []}

        answer_tokens = self._tokenize_answer(answer.raw_text) | self._tokenize_answer(" ".join(answer.extracted_concepts))
        matched: list[str] = []
        missing: list[str] = []

        for criterion in requirement.grading_criteria:
            if self._criterion_met(criterion, answer.raw_text, answer_tokens):
                matched.append(criterion)
            else:
                missing.append(criterion)

        score = len(matched) / len(requirement.grading_criteria)
        if score >= 0.85:
            status = "FULLY_MET"
        elif score > 0:
            status = "PARTIALLY_MET"
        else:
            status = "NOT_MET"

        evidence = {
            "matched_criteria": matched,
            "missing_criteria": missing,
            "criteria_score": score,
        }
        return status, score, evidence

    def _score_mcq_response(self, requirement: Requirement, answer: AnswerSegment) -> tuple[str, float, dict[str, Any]]:
        selected_labels = self._extract_selected_labels(answer.raw_text)
        correct_labels = [label.upper() for label in requirement.correct_option_labels]

        evidence: dict[str, Any] = {
            "selected_labels": selected_labels,
            "correct_labels": correct_labels,
        }

        if not selected_labels:
            return "NOT_MET", 0.0, evidence

        if not correct_labels and requirement.grading_criteria:
            open_status, open_score, open_evidence = self._score_open_response(requirement, answer)
            evidence.update(open_evidence)
            evidence["fallback_mode"] = "criteria_based_mcq"
            if open_score >= 0.85:
                return "FULLY_MET", 1.0, evidence
            if open_score > 0:
                return "PARTIALLY_MET", open_score, evidence
            return "NOT_MET", 0.0, evidence

        selected_set = set(selected_labels)
        correct_set = set(correct_labels)

        if selected_set == correct_set and correct_set:
            return "FULLY_MET", 1.0, evidence

        if selected_set & correct_set:
            return "PARTIALLY_MET", 0.5, evidence

        return "NOT_MET", 0.0, evidence

    def split_answers_by_questions(
        self,
        assignment: Assignment,
        student_answer_text: str,
    ) -> list[AnswerSegment]:
        if len(assignment.questions) == 1:
            return [
                AnswerSegment(
                    question_id=assignment.questions[0].id,
                    raw_text=student_answer_text,
                )
            ]

        marker_pattern = re.compile(r"(?im)^\s*(?:question|q)\s*(\d+)\s*[:\).\-]?|^\s*(\d+)\s*[\).]\s*")
        matches = list(marker_pattern.finditer(student_answer_text))

        if not matches:
            paragraphs = [paragraph.strip() for paragraph in re.split(r"\n\s*\n", student_answer_text) if paragraph.strip()]
            if len(paragraphs) >= len(assignment.questions) and len(assignment.questions) > 1:
                return [
                    AnswerSegment(question_id=question.id, raw_text=paragraphs[index])
                    for index, question in enumerate(assignment.questions)
                ]

            return [
                AnswerSegment(question_id=question.id, raw_text=student_answer_text)
                for question in assignment.questions
            ]

        by_number: dict[str, str] = {}
        for index, match in enumerate(matches):
            question_number = match.group(1) or match.group(2)
            start = match.end()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(student_answer_text)
            body = student_answer_text[start:end].strip()
            if body:
                by_number[question_number] = body

        segments: list[AnswerSegment] = []
        for question in assignment.questions:
            question_number = self._extract_question_number(question.id)
            answer_text = by_number.get(question_number, student_answer_text)
            segments.append(
                AnswerSegment(
                    question_id=question.id,
                    raw_text=answer_text,
                )
            )
        return segments

    def extract_concepts_from_answer(self, text: str) -> list[str]:
        prompt = (
            "You are given a student's answer.\n"
            "Return a list of key concepts as a comma-separated list.\n"
            "Use short concept phrases only.\n\n"
            f"Answer: {text}"
        )
        response = self.helper.chat_completion(
            "You are an academic assistant that extracts key concepts from student answers.",
            prompt,
        )
        return [concept.strip() for concept in response.split(",") if concept.strip()]

    def analyze_submission(
        self,
        assignment: Assignment,
        submission: Submission,
    ) -> SubmissionAnalysis:
        segments = self.split_answers_by_questions(assignment, submission.answer_text)
        all_concepts: list[str] = []
        for segment in segments:
            segment.extracted_concepts = self.extract_concepts_from_answer(segment.raw_text)
            all_concepts.extend(segment.extracted_concepts)
            segment.embedding = self.helper.get_embedding(segment.raw_text)

        return SubmissionAnalysis(
            segmented_answers=segments,
            extracted_concepts=list(dict.fromkeys(all_concepts)),
        )


class MatchingEngine:
    def __init__(self, helper: OpenAIHomeworkHelper):
        self.helper = helper

    @staticmethod
    def _normalize_token(token: str) -> str:
        normalized = token.lower().strip()
        normalized = re.sub(r"[^a-z0-9]+", "", normalized)
        if len(normalized) > 4 and normalized.endswith("ing"):
            normalized = normalized[:-3]
        elif len(normalized) > 3 and normalized.endswith("ed"):
            normalized = normalized[:-2]
        elif len(normalized) > 3 and normalized.endswith("es"):
            normalized = normalized[:-2]
        elif len(normalized) > 2 and normalized.endswith("s"):
            normalized = normalized[:-1]
        return normalized

    @classmethod
    def _tokenize(cls, text: str) -> list[str]:
        raw_tokens = re.findall(r"[A-Za-z0-9]+", text.lower())
        return [token for token in (cls._normalize_token(raw) for raw in raw_tokens) if token]

    @classmethod
    def _concept_tokens(cls, concept: str) -> list[str]:
        return cls._tokenize(concept)

    def concept_matching(
        self,
        requirement: Requirement,
        answer: AnswerSegment,
    ) -> tuple[float, list[str], list[str]]:
        if not requirement.expected_concepts:
            return 0.0, [], []

        answer_text_tokens = set(self._tokenize(answer.raw_text))
        extracted_tokens = set(self._tokenize(" ".join(answer.extracted_concepts)))
        answer_token_pool = answer_text_tokens | extracted_tokens

        matched_concepts: list[str] = []
        missing_concepts: list[str] = []

        for concept in requirement.expected_concepts:
            concept_tokens = self._concept_tokens(concept)
            if not concept_tokens:
                continue

            if all(token in answer_token_pool for token in concept_tokens):
                matched_concepts.append(concept)
            else:
                missing_concepts.append(concept)

        score = len(matched_concepts) / len(requirement.expected_concepts) if requirement.expected_concepts else 0.0
        return score, matched_concepts, missing_concepts

    def semantic_matching(
        self,
        requirement: Requirement,
        answer: AnswerSegment,
    ) -> tuple[str, float, str]:
        ideal_prompt = (
            "You are given a description of a homework requirement.\n"
            "Write a short ideal answer in 3-5 sentences that satisfies the requirement.\n\n"
            f"Requirement: {requirement.description}"
        )
        ideal_answer = self.helper.chat_completion(
            "You write ideal answers for academic assignments.",
            ideal_prompt,
        )
        ideal_embedding = self.helper.get_embedding(ideal_answer)
        if not answer.embedding:
            return "NOT_MET", 0.0, "No embedding was found for the answer."

        similarity = cosine_similarity(ideal_embedding, answer.embedding)
        if similarity >= SEMANTIC_FULLY_MET_THRESHOLD:
            status = "FULLY_MET"
        elif similarity >= SEMANTIC_PARTIAL_THRESHOLD:
            status = "PARTIALLY_MET"
        else:
            status = "NOT_MET"

        explanation = f"Similarity={similarity:.2f} between the ideal answer and the student answer."
        return status, similarity, explanation


class GradingEngine:
    def __init__(self, matching_engine: MatchingEngine):
        self.matching_engine = matching_engine

    @staticmethod
    def _tokenize_answer(text: str) -> set[str]:
        return {token for token in MatchingEngine._tokenize(text)}

    @staticmethod
    def _extract_selected_labels(answer_text: str) -> list[str]:
        # Reuse the more permissive extraction implemented in SubmissionUnderstandingLayer
        return SubmissionUnderstandingLayer._extract_selected_labels(answer_text)

    @staticmethod
    def _criterion_keywords(criterion: str) -> list[str]:
        tokens = MatchingEngine._tokenize(criterion)
        stop_words = {
            "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
            "student", "question", "answer", "should", "would", "could", "at", "least", "two",
            "one", "more", "than", "such", "as", "like", "be", "is", "are", "was", "were",
            "of", "to", "in", "on", "by", "an", "a", "or", "it", "its", "their", "how",
            "what", "which", "both", "also", "include", "includes", "provided", "provide",
            "mention", "mentioning", "list", "give", "provide", "explain", "describe",
        }
        return [token for token in tokens if token not in stop_words]

    def _criterion_met(self, criterion: str, answer_text: str, answer_tokens: set[str]) -> bool:
        lower_answer = answer_text.lower()
        lower_criterion = criterion.lower()

        if lower_criterion in lower_answer:
            return True

        keywords = self._criterion_keywords(criterion)
        if not keywords:
            return False

        matched = sum(1 for keyword in keywords if keyword in answer_tokens)
        ratio = matched / len(keywords)

        if "at least two benefits" in lower_criterion:
            benefit_markers = [
                "simplified",
                "simplify",
                "portable",
                "portability",
                "protection",
                "fault",
                "multitasking",
                "isolation",
                "safety",
                "efficiency",
                "resource",
            ]
            marker_count = sum(1 for marker in benefit_markers if marker in lower_answer)
            return marker_count >= 2

        if "example" in lower_criterion:
            return any(marker in lower_answer for marker in ("virtual memory", "process isolation", "example"))

        return ratio >= 0.6

    def _score_open_response(self, requirement: Requirement, answer: AnswerSegment) -> tuple[str, float, dict[str, Any]]:
        if not requirement.grading_criteria:
            return "NOT_MET", 0.0, {"matched_criteria": [], "missing_criteria": []}

        answer_tokens = self._tokenize_answer(answer.raw_text) | self._tokenize_answer(" ".join(answer.extracted_concepts))
        matched: list[str] = []
        missing: list[str] = []

        for criterion in requirement.grading_criteria:
            if self._criterion_met(criterion, answer.raw_text, answer_tokens):
                matched.append(criterion)
            else:
                missing.append(criterion)

        score = len(matched) / len(requirement.grading_criteria)
        if score >= 0.85:
            status = "FULLY_MET"
        elif score > 0:
            status = "PARTIALLY_MET"
        else:
            status = "NOT_MET"

        evidence = {
            "matched_criteria": matched,
            "missing_criteria": missing,
            "criteria_score": score,
        }
        return status, score, evidence

    def _score_mcq_response(self, requirement: Requirement, answer: AnswerSegment) -> tuple[str, float, dict[str, Any]]:
        selected_labels = self._extract_selected_labels(answer.raw_text)
        correct_labels = [label.upper() for label in requirement.correct_option_labels]

        evidence: dict[str, Any] = {
            "selected_labels": selected_labels,
            "correct_labels": correct_labels,
        }

        if not selected_labels:
            return "NOT_MET", 0.0, evidence

        selected_set = set(selected_labels)
        correct_set = set(correct_labels)

        if selected_set == correct_set and correct_set:
            return "FULLY_MET", 1.0, evidence

        if selected_set & correct_set:
            return "PARTIALLY_MET", 0.5, evidence

        return "NOT_MET", 0.0, evidence

    def evaluate_requirement(
        self,
        requirement: Requirement,
        answer: AnswerSegment | None,
        rubric_item: RubricItem,
    ) -> RequirementEvaluationResult:
        if answer is None or len(answer.raw_text.strip()) == 0:
            return RequirementEvaluationResult(
                rubric_item_id=rubric_item.id,
                question_id=requirement.question_id,
                status="NOT_ATTEMPTED",
                score=0.0,
                feedback="No answer was provided for this section.",
                evidence={},
            )

        if requirement.type == "mcq":
            status, score, mcq_evidence = self._score_mcq_response(requirement, answer)
            concept_score = 0.0
            matched_concepts: list[str] = []
            missing_concepts: list[str] = []
            semantic_score = 0.0
            semantic_explanation = "MCQ scoring is based on the selected option."
            evidence = mcq_evidence
        else:
            status, score, checklist_evidence = self._score_open_response(requirement, answer)
            concept_score, matched_concepts, missing_concepts = self.matching_engine.concept_matching(
                requirement,
                answer,
            )
            semantic_score = 0.0
            semantic_explanation = "Open-response scoring is based on checklist criteria."
            evidence = checklist_evidence

        return RequirementEvaluationResult(
            rubric_item_id=rubric_item.id,
            question_id=requirement.question_id,
            status=status,
            score=score,
            evidence={
                "answer_snippet": answer.raw_text[:200],
                "concept_score": concept_score,
                "matched_concepts": matched_concepts,
                "missing_concepts": missing_concepts,
                "semantic_score": semantic_score,
                "semantic_explanation": semantic_explanation,
                **evidence,
            },
        )

    def aggregate_scores(
        self,
        requirement_results: list[RequirementEvaluationResult],
        requirements: list[Requirement],
    ) -> tuple[float, dict[str, float]]:
        total_points_possible = sum(req.points for req in requirements)
        
        # If no points defined (manual upload), use equal weight for each requirement
        if total_points_possible == 0:
            per_question_scores_raw: dict[str, float] = {}
            total_score_raw = 0.0
            
            for result in requirement_results:
                per_question_scores_raw.setdefault(result.question_id, 0.0)
                per_question_scores_raw[result.question_id] += result.score
                total_score_raw += result.score
            
            num_requirements = len(requirement_results) if requirement_results else 1
            total_score = (total_score_raw / num_requirements) * 100.0 if num_requirements > 0 else 0.0
            per_question_scores = {
                question_id: (score / len([r for r in requirement_results if r.question_id == question_id])) * 100.0 
                if len([r for r in requirement_results if r.question_id == question_id]) > 0 else 0.0
                for question_id, score in per_question_scores_raw.items()
            }
            return total_score, per_question_scores
        
        # Points-based calculation (from generated homework)
        per_question_scores_raw: dict[str, float] = {}
        total_points_earned = 0.0

        for result, requirement in zip(requirement_results, requirements):
            points_earned = result.score * requirement.points
            per_question_scores_raw.setdefault(result.question_id, 0.0)
            per_question_scores_raw[result.question_id] += points_earned
            total_points_earned += points_earned

        total_score = (total_points_earned / total_points_possible) * 100.0
        per_question_scores = {}
        for question_id, score in per_question_scores_raw.items():
            question_total_points = sum(req.points for req in requirements if req.question_id == question_id)
            if question_total_points > 0:
                per_question_scores[question_id] = (score / question_total_points) * 100.0
            else:
                per_question_scores[question_id] = 0.0

        return total_score, per_question_scores


class FeedbackEngine:
    def __init__(self, helper: OpenAIHomeworkHelper):
        self.helper = helper

    def generate_requirement_feedback(
        self,
        requirement: Requirement,
        result: RequirementEvaluationResult,
        answer: AnswerSegment | None,
    ) -> str:
        base_info = (
            f"Requirement: {requirement.description}\n"
            f"Status: {result.status}\n"
            f"Student answer: {answer.raw_text if answer else ''}\n"
        )
        prompt = (
            "You are grading assignments.\n"
            "Based on the requirement, evaluation status, and student answer, "
            "write short, constructive feedback in English explaining what is good, "
            "what is missing, and what can be improved.\n\n"
            f"{base_info}"
        )
        feedback = self.helper.chat_completion(
            "You are an academic grader who provides clear and respectful feedback to students.",
            prompt,
        )
        return clean_feedback_text(feedback)

    def generate_overall_feedback(
        self,
        total_score: float,
        per_question_scores: dict[str, float],
    ) -> str:
        details = "\n".join(
            f"Question {question_id}: {score:.1f}"
            for question_id, score in per_question_scores.items()
        )
        prompt = (
            "You are grading assignments.\n"
            "Based on the total score and the score breakdown by question, "
            "write overall feedback for the student in English in 2-3 sentences, "
            "summarizing their level, strengths, and main weaknesses.\n\n"
            f"Total score: {total_score:.1f}\n"
            f"Scores by question:\n{details}"
        )
        feedback = self.helper.chat_completion(
            "You are an academic grader who provides overall feedback to students.",
            prompt,
        )
        return clean_feedback_text(feedback)


class HomeworkGradingAgent:
    def __init__(
        self,
        assignment_understanding: AssignmentUnderstandingLayer,
        submission_understanding: SubmissionUnderstandingLayer,
        grading_engine: GradingEngine,
        feedback_engine: FeedbackEngine,
    ):
        self.assignment_understanding = assignment_understanding
        self.submission_understanding = submission_understanding
        self.grading_engine = grading_engine
        self.feedback_engine = feedback_engine

    def grade(
        self,
        assignment_id: str,
        title: str,
        assignment_text: str,
        questions_text: str,
        rubric_text: str,
        submission_id: str,
        student_id: str,
        student_answer_text: str,
        structured_questions: list | None = None,
    ) -> GradingResult:
        assignment, requirements = self.assignment_understanding.build_assignment(
            assignment_id=assignment_id,
            title=title,
            assignment_text=assignment_text,
            questions_text=questions_text,
            rubric_text=rubric_text,
            structured_questions=structured_questions,
        )

        submission = Submission(
            id=submission_id,
            assignment_id=assignment_id,
            student_id=student_id,
            answer_text=student_answer_text,
        )
        analysis = self.submission_understanding.analyze_submission(assignment, submission)
        submission.analysis = analysis

        requirement_results: list[RequirementEvaluationResult] = []
        for requirement in requirements:
            rubric_item = next(
                item for item in assignment.rubric.items if item.question_id == requirement.question_id
            )
            answer = next(
                (segment for segment in analysis.segmented_answers if segment.question_id == requirement.question_id),
                None,
            )
            requirement_results.append(
                self.grading_engine.evaluate_requirement(
                    requirement=requirement,
                    answer=answer,
                    rubric_item=rubric_item,
                )
            )

        total_score, per_question_scores = self.grading_engine.aggregate_scores(requirement_results, requirements)

        for requirement, result in zip(requirements, requirement_results):
            answer = next(
                (segment for segment in analysis.segmented_answers if segment.question_id == requirement.question_id),
                None,
            )
            result.feedback = self.feedback_engine.generate_requirement_feedback(
                requirement,
                result,
                answer,
            )

        overall_feedback = self.feedback_engine.generate_overall_feedback(
            total_score,
            per_question_scores,
        )

        return GradingResult(
            submission_id=submission_id,
            total_score=total_score,
            per_question_scores=per_question_scores,
            per_requirement_results=requirement_results,
            overall_feedback=overall_feedback,
        )


def check_homework(
    *,
    assignment_id: str,
    title: str,
    assignment_text: str,
    questions_text: str,
    rubric_text: str,
    submission_id: str,
    student_id: str,
    student_answer_text: str,
    structured_questions: list | None = None,
) -> GradingResult:
    client = get_openai_client()
    helper = OpenAIHomeworkHelper(client)
    matching_engine = MatchingEngine(helper)
    grading_engine = GradingEngine(matching_engine)
    feedback_engine = FeedbackEngine(helper)
    agent = HomeworkGradingAgent(
        assignment_understanding=AssignmentUnderstandingLayer(helper),
        submission_understanding=SubmissionUnderstandingLayer(helper),
        grading_engine=grading_engine,
        feedback_engine=feedback_engine,
    )

    return agent.grade(
        assignment_id=assignment_id,
        title=title,
        assignment_text=assignment_text,
        questions_text=questions_text,
        rubric_text=rubric_text,
        submission_id=submission_id,
        student_id=student_id,
        student_answer_text=student_answer_text,
        structured_questions=structured_questions,
    )
