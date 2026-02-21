import { useMemo, useState, type SyntheticEvent } from "react";

type QuestionType = "mcq" | "open";

type QuestionSpec = {
  index: number;
  type: QuestionType;
  difficulty: "easy" | "medium" | "hard";
  points: number;
};

type GeneratedQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: QuestionSpec["difficulty"];
  points: number;
  options?: string[];
  answerHint?: string;
};

function mockGenerateQuestions(
  chapterText: string,
  specs: QuestionSpec[],
): GeneratedQuestion[] {
  const baseLines = chapterText
    .split(/[.\n]/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fallbackTopic = "the main ideas of this chapter";

  return specs.map((spec, i) => {
    const base = baseLines[i % Math.max(baseLines.length, 1)] || fallbackTopic;
    const shortBase = base.length > 160 ? `${base.slice(0, 157)}...` : base;

    if (spec.type === "mcq") {
      return {
        id: `q-${i}`,
        text: `Which of the following best describes ${shortBase}?`,
        type: "mcq",
        difficulty: spec.difficulty,
        points: spec.points,
        options: [
          `A detailed aspect of ${shortBase}`,
          `A common misunderstanding about ${shortBase}`,
          `An example or application of ${shortBase}`,
          `A concept that is not related to ${shortBase}`,
        ],
        answerHint:
          "Choose the option that matches the definition from the text.",
      };
    }

    return {
      id: `q-${i}`,
      text: `Explain ${shortBase} in your own words. Include at least one example from the chapter.
`,
      type: "open",
      difficulty: spec.difficulty,
      points: spec.points,
      answerHint:
        "Look back at the relevant paragraph and summarise the key idea.",
    };
  });
}

export default function HomeworkAgentView() {
  const [chapterSource, setChapterSource] = useState<string>("");
  const [mcqCount, setMcqCount] = useState(3);
  const [openCount, setOpenCount] = useState(0);
  const [baseDifficulty, setBaseDifficulty] = useState<
    QuestionSpec["difficulty"]
  >("medium");
  const [basePoints, setBasePoints] = useState(10);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + q.points, 0),
    [questions],
  );

  const handleGenerate = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chapterSource.trim()) return;
    setIsGenerating(true);

    const specs: QuestionSpec[] = [];
    for (let i = 0; i < mcqCount; i += 1) {
      specs.push({
        index: i,
        type: "mcq",
        difficulty: baseDifficulty,
        points: basePoints,
      });
    }

    for (let i = 0; i < openCount; i += 1) {
      specs.push({
        index: mcqCount + i,
        type: "open",
        difficulty: baseDifficulty,
        points: basePoints,
      });
    }

    const generated = mockGenerateQuestions(chapterSource, specs);
    setQuestions(generated);
    setHasGenerated(true);
    setIsGenerating(false);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
      <form
        onSubmit={handleGenerate}
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-sm font-semibold text-slate-100">
            Homework generator
          </h2>
          <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
            Step 1 · Define criteria
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-200">
              Source chapter / booklet
            </p>
            <textarea
              value={chapterSource}
              onChange={(ev) => setChapterSource(ev.target.value)}
              placeholder="Paste a chapter or section from the course booklet here. The agent will invent questions based on this text."
              className="min-h-[140px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Later we can add file upload (PDF / DOCX) so the agent can read full booklets.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Multiple‑choice questions</span>
                <span className="text-slate-500">0–20</span>
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={mcqCount}
                onChange={(ev) => setMcqCount(Number(ev.target.value) || 0)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Open‑ended questions</span>
                <span className="text-slate-500">0–20</span>
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={openCount}
                onChange={(ev) => setOpenCount(Number(ev.target.value) || 0)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Base difficulty</span>
                <span className="text-slate-500">per question</span>
              </label>
              <select
                value={baseDifficulty}
                onChange={(ev) =>
                  setBaseDifficulty(ev.target.value as QuestionSpec["difficulty"])
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-end">
            <div className="space-y-1">
              <label className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Points per question</span>
                <span className="text-slate-500">approximate</span>
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={basePoints}
                onChange={(ev) => setBasePoints(Number(ev.target.value) || 1)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-[11px] text-slate-400">
              <span>
                Total questions: {mcqCount + openCount} · Estimated points: ~
                <strong className="ml-0.5 text-slate-100">
                  {(mcqCount + openCount) * basePoints}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-between items-center">
          <p className="text-[11px] text-slate-400 max-w-xs">
            Paste a chapter, decide how many multiple‑choice and open questions
            you want, and generate a draft homework set you can edit.
          </p>
          <button
            type="submit"
            disabled={
              !chapterSource.trim() || mcqCount + openCount === 0 || isGenerating
            }
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_14px_35px_rgba(16,185,129,0.55)] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? "Generating questions..." : "Generate homework set"}
          </button>
        </div>
      </form>

      {/* Output side */}
      <div
        className="rounded-2xl border border-slate-800/70 bg-slate-950/70 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-3 min-h-[260px]"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Generated homework
            </h3>
            <p className="text-[11px] text-slate-400">
              Preview of questions the agent builds from your chapter.
            </p>
          </div>
          {hasGenerated && (
            <div className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              Total points: {totalPoints}
            </div>
          )}
        </div>

        {!hasGenerated ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 px-4 py-6 text-center text-[11px] text-slate-400">
            <p className="mb-1 font-medium text-slate-200">
              No homework generated yet
            </p>
            <p>
              Paste a chapter on the left, choose how many questions you
              want and their difficulty, and generate a draft homework set.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-3 text-xs text-slate-100 shadow-inner"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-200">
                      {idx + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-200">
                      <span>{q.type === "mcq" ? "Multiple‑choice" : "Open‑ended"}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-500" />
                      <span className="capitalize">{q.difficulty}</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-300">
                    {q.points} pts
                  </span>
                </div>

                <p className="whitespace-pre-line text-[11px] text-slate-100">
                  {q.text}
                </p>

                {q.options && (
                  <ul className="mt-2 grid gap-1 text-[11px] text-slate-200 sm:grid-cols-2">
                    {q.options.map((opt, optIdx) => (
                      <li
                        key={optIdx}
                        className="flex items-start gap-1.5"
                      >
                        <span className="mt-[1px] text-[10px] text-slate-500">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {q.answerHint && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    <span className="font-medium text-slate-300">
                      Teacher hint:
                    </span>{" "}
                    {q.answerHint}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
