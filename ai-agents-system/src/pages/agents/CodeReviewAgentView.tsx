import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useParams } from "react-router-dom";

import AgentActionButton from "../../components/AgentActionButton";
import {
  fetchCodeReviewOptions,
  runCodeReview,
  type CodeReviewOptionsResponse,
  type CodeReviewResponse,
} from "../../lib/api";
import { createRun, createSession } from "../../lib/sessionStore";
import type { SessionRun } from "../../types/course";

type CodeReviewAgentViewProps = {
  selectedRun?: SessionRun | null;
  onClearSelectedRun?: () => void;
  clearSelectionVersion?: number;
};

type RunMode = "review" | "generate";

type SavedCodeReviewInput = {
  language?: string;
  difficulty_level?: string;
  exercise_description?: string;
  code?: string;
  run_mode?: RunMode;
};

type SavedCodeReviewOutput = {
  result?: CodeReviewResponse | null;
};

type ParsedReviewSections = {
  intent: string[];
  strengths: string[];
  risks: string[];
  improvements: string[];
  questions: string[];
};

const fallbackOptions: CodeReviewOptionsResponse = {
  languages: ["Python", "Java", "C", "C++", "JavaScript"],
  difficulty_levels: ["Beginner", "Intermediate", "Advanced"],
};

const sectionMatchers: Array<{
  key: keyof ParsedReviewSections;
  pattern: RegExp;
}> = [
  {
    key: "intent",
    pattern: /^\s*(?:1\.\s*)?what the code is trying to do\s*:?\s*$/i,
  },
  {
    key: "strengths",
    pattern: /^\s*(?:2\.\s*)?what is good in the solution\s*:?\s*$/i,
  },
  {
    key: "risks",
    pattern: /^\s*(?:3\.\s*)?problems,\s*weaknesses,\s*or\s*risks\s*:?\s*$/i,
  },
  {
    key: "improvements",
    pattern: /^\s*(?:4\.\s*)?conceptual improvements\s*:?\s*$/i,
  },
  {
    key: "questions",
    pattern: /^\s*(?:5\.\s*)?reflection questions for the learner\s*:?\s*$/i,
  },
];

const emptySections = (): ParsedReviewSections => ({
  intent: [],
  strengths: [],
  risks: [],
  improvements: [],
  questions: [],
});

function normalizeSectionContent(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines;
  }

  if (lines.length === 1) {
    return lines[0]
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parsePedagogicalReview(review: string): ParsedReviewSections {
  const sections = emptySections();
  const lines = review.split(/\r?\n/);
  let currentSection: keyof ParsedReviewSections | null = null;
  let foundHeading = false;
  const buckets: Record<keyof ParsedReviewSections, string[]> = emptySections();

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    const matchedSection = sectionMatchers.find((section) => section.pattern.test(line));
    if (matchedSection) {
      currentSection = matchedSection.key;
      foundHeading = true;
      return;
    }

    if (!currentSection || !line) {
      return;
    }

    buckets[currentSection].push(line);
  });

  if (!foundHeading) {
    sections.improvements = normalizeSectionContent(review);
    return sections;
  }

  (Object.keys(buckets) as Array<keyof ParsedReviewSections>).forEach((key) => {
    sections[key] = normalizeSectionContent(buckets[key].join("\n"));
  });

  return sections;
}

export default function CodeReviewAgentView({
  selectedRun = null,
  onClearSelectedRun,
  clearSelectionVersion = 0,
}: CodeReviewAgentViewProps) {
  const { courseId = "", agentKey = "" } = useParams();
  const [options, setOptions] = useState<CodeReviewOptionsResponse>(fallbackOptions);
  const [language, setLanguage] = useState(fallbackOptions.languages[0]);
  const [difficultyLevel, setDifficultyLevel] = useState(
    fallbackOptions.difficulty_levels[1],
  );
  const [exerciseDescription, setExerciseDescription] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CodeReviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [activeRunMode, setActiveRunMode] = useState<RunMode | null>(null);

  const parsedReview = useMemo(
    () => parsePedagogicalReview(result?.pedagogical_review ?? ""),
    [result],
  );

  const inputCodeLineCount = useMemo(() => {
    const trimmed = code.trim();
    return trimmed ? trimmed.split(/\r?\n/).length : 0;
  }, [code]);

  const displayedCode = result?.generated_sample_solution || code;

  const loadOptions = async () => {
    try {
      const nextOptions = await fetchCodeReviewOptions();
      setOptions(nextOptions);
      setLanguage((current) =>
        nextOptions.languages.includes(current) ? current : nextOptions.languages[0],
      );
      setDifficultyLevel((current) =>
        nextOptions.difficulty_levels.includes(current)
          ? current
          : nextOptions.difficulty_levels[0],
      );
      setOptionsError(null);
    } catch (error) {
      setOptions(fallbackOptions);
      setOptionsError(
        error instanceof Error
          ? `${error.message} Using fallback options in the form.`
          : "Could not load code review options. Using fallback options.",
      );
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    if (!selectedRun) {
      return;
    }

    const inputData =
      selectedRun.input_data && typeof selectedRun.input_data === "object"
        ? (selectedRun.input_data as SavedCodeReviewInput)
        : null;
    const outputData =
      selectedRun.output_data && typeof selectedRun.output_data === "object"
        ? (selectedRun.output_data as SavedCodeReviewOutput)
        : null;

    if (typeof inputData?.language === "string" && inputData.language.trim()) {
      setLanguage(inputData.language.trim());
    }
    if (
      typeof inputData?.difficulty_level === "string" &&
      inputData.difficulty_level.trim()
    ) {
      setDifficultyLevel(inputData.difficulty_level.trim());
    }
    if (typeof inputData?.exercise_description === "string") {
      setExerciseDescription(inputData.exercise_description);
    }
    if (typeof inputData?.code === "string") {
      setCode(inputData.code);
    }

    setResult(outputData?.result ?? null);
    setErrorMessage(null);
    setSaveMessage(null);
    setSaveState("idle");
    setActiveRunMode(inputData?.run_mode ?? null);
  }, [selectedRun]);

  useEffect(() => {
    setLanguage(fallbackOptions.languages[0]);
    setDifficultyLevel(fallbackOptions.difficulty_levels[1]);
    setExerciseDescription("");
    setCode("");
    setResult(null);
    setErrorMessage(null);
    setSaveMessage(null);
    setSaveState("idle");
    setIsLoading(false);
    setActiveRunMode(null);
  }, [clearSelectionVersion]);

  const handleRun = async (mode: RunMode) => {
    if (mode === "review" && !code.trim()) {
      setErrorMessage("Paste code before running a code review.");
      return;
    }

    setErrorMessage(null);
    setSaveMessage(null);
    setSaveState("idle");
    setIsLoading(true);
    setActiveRunMode(mode);

    try {
      const response = await runCodeReview({
        language,
        difficulty_level: difficultyLevel,
        exercise_description: exerciseDescription.trim() || undefined,
        code: mode === "review" ? code.trim() : "",
        generate_sample_if_empty: mode === "generate",
      });
      setResult(response);
      if (mode === "generate") {
        setCode(response.generated_sample_solution);
      }
    } catch (error) {
      setResult(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Code review failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleRun("review");
  };

  const handleSaveOutput = async () => {
    if (!courseId || !agentKey) {
      setSaveState("error");
      setSaveMessage("Course context is missing, so the review could not be saved.");
      return;
    }

    if (!result) {
      setSaveState("error");
      setSaveMessage("Run the code review before saving the output.");
      return;
    }

    const timestamp = new Date();
    const timestampLabel = timestamp.toLocaleString();
    const sessionTitle = `${language} ${difficultyLevel} code review · ${timestampLabel}`;

    try {
      const session = await createSession(
        courseId,
        agentKey,
        sessionTitle,
        [
          "Code review output",
          `Timestamp: ${timestampLabel}`,
          `Mode: ${result.source}`,
        ].join("\n"),
      );

      await createRun(
        session.id,
        {
          language,
          difficulty_level: difficultyLevel,
          exercise_description: exerciseDescription,
          code,
          run_mode: activeRunMode,
        },
        { result },
        "success",
      );

      setSaveState("success");
      setSaveMessage("Code review output saved to session history.");
      onClearSelectedRun?.();
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Could not save code review output.",
      );
    }
  };

  const handleCopyCode = async () => {
    if (!displayedCode.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(displayedCode);
      setSaveState("success");
      setSaveMessage("Code copied to clipboard.");
    } catch {
      setSaveState("error");
      setSaveMessage("Could not copy the code.");
    }
  };

  const clearForm = () => {
    setExerciseDescription("");
    setCode("");
    setResult(null);
    setErrorMessage(null);
    setSaveMessage(null);
    setSaveState("idle");
    setActiveRunMode(null);
  };

  return (
    <div className="grid items-stretch gap-6 md:h-[max(64rem,calc(100vh-2rem))] md:grid-cols-[minmax(0,2fr)_minmax(0,1.45fr)]">
      <form
        onSubmit={handleSubmit}
        className="flex h-full min-h-[40rem] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-100">Code review input</h2>
          <div className="rounded-full border border-slate-700/80 bg-slate-950/50 px-3 py-1 text-[11px] text-slate-300">
            Real backend agent
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Paste code to review it directly, or leave the code box empty and use sample
          generation for the original teaching-demo flow.
        </p>

        {optionsError ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {optionsError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Language
            </span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            >
              {options.languages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Difficulty
            </span>
            <select
              value={difficultyLevel}
              onChange={(event) => setDifficultyLevel(event.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            >
              {options.difficulty_levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-3">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Exercise description
          </span>
          <textarea
            value={exerciseDescription}
            onChange={(event) => setExerciseDescription(event.target.value)}
            placeholder="Optional but recommended: describe the task the code is solving."
            rows={4}
            className="mt-3 min-h-[7.5rem] w-full resize-y rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
          />
        </label>

        <label className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800/60 bg-slate-950/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Code to review
            </span>
            <span className="text-[11px] text-slate-500">
              {inputCodeLineCount} line{inputCodeLineCount === 1 ? "" : "s"}
            </span>
          </div>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Paste the student code here. If you leave this empty, use 'Generate sample + review' instead."
            className="mt-3 min-h-[18rem] flex-1 resize-y rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
          />
        </label>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <AgentActionButton
              type="submit"
              variant="emerald"
              disabled={isLoading || !code.trim()}
            >
              {isLoading && activeRunMode === "review"
                ? "Running review..."
                : "Run code review"}
            </AgentActionButton>
            <AgentActionButton
              onClick={() => void handleRun("generate")}
              variant="violet"
              disabled={isLoading}
            >
              {isLoading && activeRunMode === "generate"
                ? "Generating sample..."
                : "Generate sample + review"}
            </AgentActionButton>
          </div>

          <AgentActionButton onClick={clearForm} variant="rose" disabled={isLoading}>
            Clear form
          </AgentActionButton>
        </div>
      </form>

      <div className="flex h-full min-h-[40rem] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Pedagogical review</h2>
            <p className="mt-1 text-xs text-slate-400">
              The results panel reflects the actual backend agent response.
            </p>
          </div>
          {result ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
              {result.source === "submitted_code" ? "Reviewed submitted code" : "Generated sample"}
            </span>
          ) : null}
        </div>

        {!result && !isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-4 py-6 text-center text-[11px] text-slate-400">
            <p className="mb-1 font-medium text-slate-200">No review yet</p>
            <p>
              Run the code review from the left. The generated explanation, strengths,
              risks, improvements, and learner questions will appear here.
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-xs text-sky-100">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-100 border-t-transparent" />
              <span>
                {activeRunMode === "generate"
                  ? "Generating a student-like sample and running the review..."
                  : "Reviewing the submitted code..."}
              </span>
            </div>
          </div>
        ) : null}

        {result ? (
          <>
            <div className="flex flex-wrap gap-2">
              <AgentActionButton onClick={handleSaveOutput} variant="sky">
                Save output
              </AgentActionButton>
              <AgentActionButton onClick={handleCopyCode} variant="emerald">
                Copy reviewed code
              </AgentActionButton>
            </div>

            {saveMessage ? (
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  saveState === "success"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                }`}
              >
                {saveMessage}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Language
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {result.specification.language}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Difficulty
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {result.specification.difficulty_level}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Exercise description
                  </p>
                  <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-slate-200">
                    {result.exercise_description}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Reviewed code
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/80 p-3 text-[11px] text-slate-200">
                    <code>{displayedCode}</code>
                  </pre>
                </div>

                {[
                  {
                    title: "What the code is trying to do",
                    items: parsedReview.intent,
                  },
                  {
                    title: "Strengths",
                    items: parsedReview.strengths,
                  },
                  {
                    title: "Common mistakes or risks",
                    items: parsedReview.risks,
                  },
                  {
                    title: "Conceptual improvement suggestions",
                    items: parsedReview.improvements,
                  },
                  {
                    title: "Reflection questions for the student",
                    items: parsedReview.questions,
                  },
                ].map((section) => (
                  <div
                    key={section.title}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-100">{section.title}</p>
                    {section.items.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-300">
                        {section.items.map((item, index) => (
                          <li key={`${section.title}-${index}`} className="flex gap-2">
                            <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-sky-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-500">
                        This section was not returned explicitly by the agent.
                      </p>
                    )}
                  </div>
                ))}

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Raw agent review
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
                    {result.pedagogical_review}
                  </pre>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
