import { useMemo, useState, type SyntheticEvent } from "react";

type MockReview = {
  score: number;
  level: "needs-work" | "good" | "excellent";
  strengths: string[];
  improvements: string[];
};

function buildMockReview(
  submission: string,
  criteria: string,
): MockReview | null {
  const trimmed = submission.trim();
  if (!trimmed) return null;

  const wordCount = trimmed.split(/\s+/).length;
  let score: number;
  let level: MockReview["level"];

  if (wordCount < 50) {
    score = 58;
    level = "needs-work";
  } else if (wordCount < 150) {
    score = 76;
    level = "good";
  } else {
    score = 93;
    level = "excellent";
  }

  const strengths: string[] = [];
  const improvements: string[] = [];

  strengths.push(
    `The submission is about ${wordCount} words long, which gives enough context for an automatic check.`,
  );

  if (criteria.trim()) {
    strengths.push(
      "You provided clear evaluation criteria, which helps focus the feedback.",
    );
  } else {
    improvements.push(
      "Add explicit criteria or a rubric so the agent can align the grading with your expectations.",
    );
  }

  if (wordCount < 80) {
    improvements.push(
      "Encourage the student to expand their reasoning with more steps and explanations.",
    );
  } else {
    strengths.push("The answer includes enough detail to understand the reasoning.");
  }

  return { score, level, strengths, improvements };
}

export default function EvaluationAgentView() {
  const [assignment, setAssignment] = useState("");
  const [criteria, setCriteria] = useState("");
  const [submission, setSubmission] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const review = useMemo(
    () => buildMockReview(submission, criteria),
    [submission, criteria],
  );

  const rubricItems = useMemo(
    () =>
      criteria
        .split(/\n|;/)
        .map((item) => item.trim())
        .filter(Boolean),
    [criteria],
  );

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasSubmitted(true);
    setIsChecking(true);

    setTimeout(() => setIsChecking(false), 400);
  };

  const clearAll = () => {
    setAssignment("");
    setCriteria("");
    setSubmission("");
    setHasSubmitted(false);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
      {/* Input side */}
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
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Assignment instructions & questions</span>
              <span className="text-slate-500">For example: exercise sheet, project brief…</span>
            </div>
            <textarea
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
              placeholder="Paste the homework description, questions and any important notes you gave to the students."
              className="min-h-[90px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Evaluation criteria / rubric</span>
              <span className="text-slate-500">What does a good answer look like?</span>
            </div>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="List the main criteria: correctness, reasoning, structure, code style, use of concepts, etc."
              className="min-h-[80px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Student submission</span>
              <span className="text-slate-500">The work you want to check</span>
            </div>
            <textarea
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder="Paste the student's answer, solution steps or code to be checked."
              className="min-h-[130px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>Student answer length</span>
          <span>{submission.trim().split(/\s+/).filter(Boolean).length} words</span>
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
            disabled={!submission.trim() || isChecking}
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

      {/* Result side */}
      <div
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span className="text-base">📝</span>
          Automated homework review
        </h2>

        {!hasSubmitted ? (
          <p className="text-xs text-slate-400">
            Fill in the assignment, rubric and a student submission on the left,
            then click
            <span className="font-medium text-emerald-300"> Run homework check</span>
            . The suggested grade and feedback will appear here.
          </p>
        ) : !review ? (
          <p className="text-xs text-amber-300">
            There is no student submission to analyse yet. Paste an answer and try again.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950/90 via-slate-900/90 to-emerald-900/40 px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Suggested grade
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-emerald-300">
                    {review.score}
                  </span>
                  <span className="text-sm text-slate-400">/ 100</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.7)] transition-all"
                    style={{ width: `${Math.min(Math.max(review.score, 0), 100)}%` }}
                  />
                </div>
              </div>
              <span
                className={
                  "rounded-full px-3 py-1 text-[11px] font-medium " +
                  (review.level === "excellent"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                    : review.level === "good"
                    ? "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/40")
                }
              >
                {review.level === "excellent"
                  ? "Excellent work"
                  : review.level === "good"
                  ? "Good, with room to grow"
                  : "Needs more development"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-200">
                  Strengths
                </p>
                <ul className="space-y-1 text-[11px] text-slate-300">
                  {review.strengths.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-200">
                  Suggested improvements
                </p>
                <ul className="space-y-1 text-[11px] text-slate-300">
                  {review.improvements.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="mb-1 text-[11px] font-semibold text-slate-200">
                Rubric checklist
              </p>
              {rubricItems.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  No rubric items were added yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {rubricItems.map((item, idx) => (
                    <span
                      key={idx}
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
          </div>
        )}

        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Use this view to quickly inspect how well a submission matches your assignment and rubric.
        </p>
      </div>
    </div>
  );
}
