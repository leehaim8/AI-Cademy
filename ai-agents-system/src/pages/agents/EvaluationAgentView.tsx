import { useMemo, useState, type SyntheticEvent } from "react";
import { useLocation } from "react-router-dom";

import {
  checkHomework,
  type HomeworkCheckResponse,
} from "../../lib/api";

function getReviewLevel(score: number): "needs-work" | "good" | "excellent" {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  return "needs-work";
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }
  return `${Math.round(value * 100)}%`;
}

export default function EvaluationAgentView() {
  const location = useLocation() as {
    state?: {
      fromHomeworkAgent?: boolean;
      assignment?: string;
      questionsText?: string;
      criteria?: string;
    };
  };
  const importedFromHomework = Boolean(location.state?.fromHomeworkAgent);
  const importedAssignment =
    importedFromHomework && typeof location.state?.assignment === "string"
      ? location.state.assignment
      : "";
  const importedCriteria =
    importedFromHomework && typeof location.state?.criteria === "string"
      ? location.state.criteria
      : "";
  const importedQuestionsText =
    importedFromHomework && typeof location.state?.questionsText === "string"
      ? location.state.questionsText
      : "";

  const [assignment, setAssignment] = useState(importedAssignment);
  const [criteria, setCriteria] = useState(importedCriteria);
  const [questionsText, setQuestionsText] = useState(importedQuestionsText);
  const [submission, setSubmission] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [review, setReview] = useState<HomeworkCheckResponse | null>(null);

  const rubricItems = useMemo(
    () =>
      criteria
        .split(/\n|;/)
        .map((item) => item.trim())
        .filter(Boolean),
    [criteria],
  );

  const wordCount = submission.trim().split(/\s+/).filter(Boolean).length;
  const reviewLevel = getReviewLevel(review?.total_score ?? 0);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setIsChecking(true);
    setErrorMessage(null);

    try {
      const result = await checkHomework({
        assignment_id: "assignment-1",
        title: "Homework check",
        assignment_text: assignment.trim(),
        questions_text: (questionsText || assignment).trim(),
        rubric_text: criteria.trim(),
        submission_id: crypto.randomUUID(),
        student_id: "student-1",
        student_answer_text: submission.trim(),
      });
      setReview(result);
    } catch (error) {
      setReview(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Homework checking failed.",
      );
    } finally {
      setIsChecking(false);
    }
  };

  const clearAll = () => {
    setAssignment("");
    setCriteria("");
    setQuestionsText("");
    setSubmission("");
    setHasSubmitted(false);
    setErrorMessage(null);
    setReview(null);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-sm font-semibold text-slate-100">
            Homework checking input
          </h2>
          <span className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            Step 1 · Define task & answer
          </span>
        </div>

        <div className="space-y-3">
          {importedFromHomework ? (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
              Imported from Homework Generator
            </div>
          ) : null}

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Assignment instructions & questions</span>
              <span className="text-slate-500">Paste the homework prompt or generated assignment</span>
            </div>
            <textarea
              value={assignment}
              onChange={(event) => setAssignment(event.target.value)}
              placeholder="Paste the homework description and questions."
              className="min-h-[110px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Grading criteria / rubric</span>
              <span className="text-slate-500">One line per criterion works best</span>
            </div>
            <textarea
              value={criteria}
              onChange={(event) => setCriteria(event.target.value)}
              placeholder="List the rubric or grading criteria."
              className="min-h-[100px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Student submission</span>
              <span className="text-slate-500">The answer you want to evaluate</span>
            </div>
            <textarea
              value={submission}
              onChange={(event) => setSubmission(event.target.value)}
              placeholder="Paste the student's answer, separated by Question 1 / Question 2 when possible."
              className="min-h-[150px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>Student answer length</span>
          <span>{wordCount} words</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
          >
            Clear all fields
          </button>
          <button
            type="submit"
            disabled={!assignment.trim() || !criteria.trim() || !submission.trim() || isChecking}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_35px_rgba(16,185,129,0.5)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
          >
            {isChecking ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-100 border-t-transparent" />
                Checking...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Run homework check</span>
                <span>✅</span>
              </span>
            )}
          </button>
        </div>
      </form>

      <div
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span className="text-base">📝</span>
          Automated homework grading
        </h2>

        {!hasSubmitted ? (
          <p className="text-xs text-slate-400">
            Fill in the assignment, rubric and a student submission on the left,
            then click
            <span className="font-medium text-emerald-300"> Run homework check</span>.
            The suggested grade and feedback will appear here
          </p>
        ) : isChecking ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-100 border-t-transparent" />
              <span>Checking the submission and generating feedback...</span>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errorMessage}
          </div>
        ) : !review ? (
          <p className="text-xs text-amber-300">
            There is no student submission to analyse yet. Paste an answer and try again
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950/90 via-slate-900/90 to-emerald-900/40 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Suggested grade
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-emerald-300">
                    {Math.round(review.total_score)}
                  </span>
                  <span className="text-sm text-slate-400">/ 100</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.7)] transition-all"
                    style={{ width: `${Math.min(Math.max(review.total_score, 0), 100)}%` }}
                  />
                </div>
              </div>
              <span
                className={
                  "rounded-full px-3 py-1 text-[11px] font-medium " +
                  (reviewLevel === "excellent"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                    : reviewLevel === "good"
                      ? "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                      : "bg-amber-500/15 text-amber-300 border border-amber-500/40")
                }
              >
                {reviewLevel === "excellent"
                  ? "Excellent work"
                  : reviewLevel === "good"
                    ? "Good, with room to grow"
                    : "Needs more development"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="mb-1 text-[11px] font-semibold text-slate-200">
                Overall feedback
              </p>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {review.overall_feedback}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="mb-2 text-[11px] font-semibold text-slate-200">
                Scores by question
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(review.per_question_scores).map(([questionId, score]) => (
                  <span
                    key={questionId}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] text-sky-100"
                  >
                    <span>{questionId}</span>
                    <span className="text-sky-300">{Math.round(score)}/100</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="mb-2 text-[11px] font-semibold text-slate-200">
                Rubric checklist
              </p>
              {rubricItems.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  No rubric items were added yet
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {rubricItems.map((item, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] text-sky-100"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                      <span className="truncate max-w-[11rem]" title={item}>
                        {item}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {review.per_requirement_results.map((item) => (
                <div
                  key={`${item.rubric_item_id}-${item.question_id}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                        {item.question_id}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-200">
                        {item.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-300">
                      {Math.round(item.score)}/100
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                    {item.feedback}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Matched concepts
                      </p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        {item.evidence.matched_concepts.length > 0
                          ? item.evidence.matched_concepts.join(", ")
                          : "None"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Missing concepts
                      </p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        {item.evidence.missing_concepts.length > 0
                          ? item.evidence.missing_concepts.join(", ")
                          : "None"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Concept score
                      </p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        {formatPercent(item.evidence.concept_score)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Semantic score
                      </p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        {formatPercent(item.evidence.semantic_score)}
                      </p>
                    </div>
                  </div>

                  {item.evidence.answer_snippet ? (
                    <div className="mt-2 rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Answer snippet
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                        {item.evidence.answer_snippet}
                      </p>
                    </div>
                  ) : null}

                  {item.evidence.semantic_explanation ? (
                    <p className="mt-2 text-[11px] text-slate-400">
                      {item.evidence.semantic_explanation}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Use this view to inspect how well a submission matches your assignment and rubric
        </p>
      </div>
    </div>
  );
}
