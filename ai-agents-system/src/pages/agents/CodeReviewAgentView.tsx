import { useMemo, useState } from "react";

type CodeReviewConfig = {
  language: "Python" | "JavaScript" | "C" | "Java";
  difficulty: "Easy" | "Medium" | "Hard";
  mistakesLevel: 0 | 1 | 2 | 3;
  outputStyle: "Concise" | "Detailed";
  assignmentPrompt: string;
  constraints: string;
};

type ReviewResult = {
  intent: string[];
  positives: string[];
  issues: string[];
  improvements: string[];
  questions: string[];
};

type RunLogItem = {
  id: string;
  timestamp: string;
  status: "info" | "success" | "warning" | "error";
  message: string;
};

type AgentState =
  | "idle"
  | "generating"
  | "code_ready"
  | "reviewing"
  | "reviewed"
  | "error";

type TabKey = "code" | "review" | "log";

type LastAction = "generate" | "review" | null;

const defaultConfig: CodeReviewConfig = {
  language: "Python",
  difficulty: "Medium",
  mistakesLevel: 2,
  outputStyle: "Detailed",
  assignmentPrompt: "",
  constraints: "",
};

const randomDelay = (min = 700, max = 1400) =>
  new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (max - min)) + min));

const mockGenerateStudentCode = async (
  config: CodeReviewConfig,
): Promise<{ code: string }> => {
  await randomDelay();

  const mistakes = config.mistakesLevel;

  const snippets: Record<CodeReviewConfig["language"], string[]> = {
    Python: [
      `def count_unique(nums):\n    seen = []\n    for n in nums:\n        if n not in seen:\n            seen.append(n)\n    return len(seen)\n\nprint(count_unique([1,2,2,3]))`,
      `def sum_even(nums):\n    total = 0\n    for i in range(len(nums)):\n        if i % 2 == 0:\n            total += nums[i]\n    return total\n\nprint(sum_even([1,2,3,4]))`,
      `def find_max(nums):\n    max_val = 0\n    for n in nums:\n        if n > max_val:\n            max_val = n\n    return max_val`,
    ],
    JavaScript: [
      `function reverseWords(text) {\n  const parts = text.split(" ");\n  let out = [];\n  for (let i = parts.length; i >= 0; i--) {\n    out.push(parts[i]);\n  }\n  return out.join(" ");\n}\nconsole.log(reverseWords("hello world"));`,
      `function isPrime(n) {\n  if (n <= 1) return true;\n  for (let i = 2; i < n; i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}`,
      `function average(nums) {\n  let total = 0;\n  nums.forEach((n) => (total += n));\n  return total / nums.length;\n}\nconsole.log(average([]));`,
    ],
    C: [
      `#include <stdio.h>\nint main() {\n  int nums[] = {3, 1, 4};\n  int max = 0;\n  for (int i = 0; i <= 3; i++) {\n    if (nums[i] > max) max = nums[i];\n  }\n  printf("%d\\n", max);\n  return 0;\n}`,
      `#include <stdio.h>\nint sum(int a, int b) {\n  return a + b;\n}\nint main() {\n  printf("%d\\n", sum(2, 3));\n}`,
      `#include <stdio.h>\nint factorial(int n) {\n  if (n == 0) return 0;\n  return n * factorial(n - 1);\n}\n`,
    ],
    Java: [
      `class Main {\n  static int min(int[] nums) {\n    int min = 0;\n    for (int n : nums) {\n      if (n < min) min = n;\n    }\n    return min;\n  }\n  public static void main(String[] args) {\n    System.out.println(min(new int[]{3,1,2}));\n  }\n}`,
      `class Main {\n  static boolean isEven(int n) {\n    return n % 2 == 1;\n  }\n  public static void main(String[] args) {\n    System.out.println(isEven(4));\n  }\n}`,
      `class Main {\n  static int sumUpTo(int n) {\n    int total = 0;\n    for (int i = 1; i < n; i++) {\n      total += i;\n    }\n    return total;\n  }\n}`,
    ],
  };

  const baseSnippet = snippets[config.language][Math.min(mistakes, 2)];

  const annotation = mistakes === 0
    ? "// Student-like sample (clean)"
    : `// Student-like sample with ${mistakes} common mistake${mistakes > 1 ? "s" : ""}`;

  return {
    code: `${annotation}\n${baseSnippet}`,
  };
};

const mockRunCodeReview = async (
  config: CodeReviewConfig,
  code: string,
): Promise<ReviewResult> => {
  await randomDelay(800, 1600);

  const detailed = config.outputStyle === "Detailed";

  return {
    intent: [
      "The solution attempts to implement the requested algorithm in the chosen language.",
      "It demonstrates a straightforward loop-based approach with minimal abstraction.",
    ],
    positives: [
      "Readable naming for most variables.",
      "Uses basic control flow appropriately for the task.",
      detailed ? "Keeps the logic in a single function, which is easy to trace." : "Simple structure.",
    ],
    issues: [
      "Edge cases are not handled (empty input, negative values, or zero length arrays).",
      "There is at least one off-by-one or boundary issue in the loop.",
      detailed
        ? "The initialization choices (e.g., max/min defaults) can lead to incorrect results."
        : "Initialization can be incorrect.",
    ],
    improvements: [
      "Clarify assumptions and handle empty inputs early.",
      "Prefer using built-in helpers when available, but explain time complexity tradeoffs.",
      "Add small tests to validate edge cases before submission.",
    ],
    questions: [
      "What happens if the input list is empty?",
      "How would you change the loop bounds to avoid indexing beyond the array?",
      "Can you think of a faster approach, and when would it matter?",
    ],
  };
};

export default function CodeReviewAgentView() {
  const [config, setConfig] = useState<CodeReviewConfig>(defaultConfig);
  const [studentCode, setStudentCode] = useState<string>("");
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [activeTab, setActiveTab] = useState<TabKey>("code");
  const [runLog, setRunLog] = useState<RunLogItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction>(null);

  const stepIndex = useMemo(() => {
    if (agentState === "generating") return 1;
    if (agentState === "code_ready") return 1;
    if (agentState === "reviewing") return 2;
    if (agentState === "reviewed") return 2;
    if (agentState === "error") return lastAction === "review" ? 2 : 1;
    return 0;
  }, [agentState, lastAction]);

  const addLog = (status: RunLogItem["status"], message: string) => {
    setRunLog((prev) => [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        status,
        message,
      },
      ...prev,
    ]);
  };

  const handleGenerateStudentCode = async () => {
    setErrorMessage(null);
    setLastAction("generate");

    if (!config.assignmentPrompt.trim()) {
      setAgentState("error");
      setErrorMessage("Please provide the assignment prompt first.");
      addLog("warning", "Missing assignment prompt");
      return;
    }

    setAgentState("generating");
    addLog("info", "Generating student code");

    try {
      const result = await mockGenerateStudentCode(config);
      setStudentCode(result.code);
      setReviewResult(null);
      setAgentState("code_ready");
      setActiveTab("code");
      addLog("success", "Student code generated");
    } catch (error) {
      setAgentState("error");
      setErrorMessage("Failed to generate student code. Please retry.");
      addLog("error", "Code generation failed");
    }
  };

  const handleRunReview = async () => {
    if (!studentCode) return;
    setErrorMessage(null);
    setLastAction("review");
    setAgentState("reviewing");
    setActiveTab("review");
    addLog("info", "Running pedagogical review");

    try {
      const result = await mockRunCodeReview(config, studentCode);
      setReviewResult(result);
      setAgentState("reviewed");
      addLog("success", "Review completed");
    } catch (error) {
      setAgentState("error");
      setErrorMessage("Review failed. Please retry.");
      addLog("error", "Review failed");
    }
  };

  const handleRetry = () => {
    if (lastAction === "review") {
      handleRunReview();
      return;
    }
    handleGenerateStudentCode();
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setStudentCode("");
    setReviewResult(null);
    setAgentState("idle");
    setActiveTab("code");
    setRunLog([]);
    setErrorMessage(null);
    setLastAction(null);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(studentCode);
      addLog("success", "Code copied to clipboard");
    } catch (error) {
      addLog("warning", "Clipboard copy failed");
    }
  };

  const codeReady =
    agentState === "code_ready" || agentState === "reviewing" || agentState === "reviewed";
  const reviewReady = agentState === "reviewed";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-100">
                Teaching / Demonstration Code Review Agent
              </h2>
              <p className="text-sm text-slate-300">
                Generates a student-like solution and then performs a pedagogical code review (demo only).
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-100">Inputs</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Language
                  <select
                    value={config.language}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        language: event.target.value as CodeReviewConfig["language"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="Python">Python</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="C">C</option>
                    <option value="Java">Java</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Difficulty
                  <select
                    value={config.difficulty}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        difficulty: event.target.value as CodeReviewConfig["difficulty"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Mistakes level
                  <select
                    value={config.mistakesLevel}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        mistakesLevel: Number(event.target.value) as CodeReviewConfig["mistakesLevel"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value={0}>0 (clean)</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Output style
                  <select
                    value={config.outputStyle}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        outputStyle: event.target.value as CodeReviewConfig["outputStyle"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="Concise">Concise</option>
                    <option value="Detailed">Detailed</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                Assignment prompt
                <textarea
                  value={config.assignmentPrompt}
                  onChange={(event) =>
                    setConfig((prev) => ({ ...prev, assignmentPrompt: event.target.value }))
                  }
                  placeholder="Paste the exercise / question here…"
                  rows={4}
                  className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                Constraints / Notes (optional)
                <textarea
                  value={config.constraints}
                  onChange={(event) =>
                    setConfig((prev) => ({ ...prev, constraints: event.target.value }))
                  }
                  placeholder="Optional: constraints, edge cases, rubric…"
                  rows={3}
                  className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </label>

              {errorMessage ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  <div className="flex items-center justify-between gap-3">
                    <span>{errorMessage}</span>
                    <button
                      onClick={handleRetry}
                      className="rounded-lg border border-rose-400/60 px-2 py-1 text-xs text-rose-100 hover:border-rose-300"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleGenerateStudentCode}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white"
                  disabled={agentState === "generating" || agentState === "reviewing"}
                >
                  {agentState === "generating" ? "Generating..." : "Generate student code"}
                </button>
                <button
                  onClick={handleRunReview}
                  disabled={!codeReady || agentState === "reviewing"}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {agentState === "reviewing" ? "Reviewing..." : "Run code review"}
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-xl border border-transparent px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-100">Progress</h3>
              <div className="flex flex-col gap-3 text-xs text-slate-300">
                {[
                  { label: "1. Student Code Generation", index: 1 },
                  { label: "2. Pedagogical Review", index: 2 },
                ].map((step) => (
                  <div
                    key={step.label}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      stepIndex >= step.index
                        ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                        : "border-slate-800/70 bg-slate-950/40 text-slate-400"
                    }`}
                  >
                    <span>{step.label}</span>
                    {stepIndex === step.index ? (
                      <span className="flex items-center gap-2 text-[11px] uppercase tracking-wide">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        Active
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                {[
                  { key: "code", label: "Student Code" },
                  { key: "review", label: "Review" },
                  { key: "log", label: "Run Log" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabKey)}
                    className={`rounded-xl px-3 py-2 transition ${
                      activeTab === tab.key
                        ? "bg-slate-100 text-slate-900"
                        : "border border-slate-800/70 bg-slate-950/40 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "code" ? (
                <div className="flex flex-col gap-3">
                  {agentState === "generating" ? (
                    <div className="space-y-3">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800/80" />
                      <div className="h-24 w-full animate-pulse rounded bg-slate-800/60" />
                    </div>
                  ) : studentCode ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-slate-100">
                          Student-like Example Code
                        </h4>
                        <button
                          onClick={handleCopyCode}
                          className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-500"
                        >
                          Copy code
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-xs text-slate-200">
                        <code>{studentCode}</code>
                      </pre>
                      <p className="text-[11px] text-amber-200/80">
                        This code intentionally may include mistakes for learning.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Generate student code to see a sample implementation.
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === "review" ? (
                <div className="flex flex-col gap-3">
                  {agentState === "reviewing" ? (
                    <div className="space-y-3">
                      <div className="h-4 w-1/2 animate-pulse rounded bg-slate-800/80" />
                      <div className="h-24 w-full animate-pulse rounded bg-slate-800/60" />
                      <div className="h-24 w-full animate-pulse rounded bg-slate-800/60" />
                    </div>
                  ) : reviewResult ? (
                    <div className="flex flex-col gap-3 text-xs text-slate-200">
                      {[
                        { title: "What the code is trying to do", items: reviewResult.intent },
                        { title: "What’s good", items: reviewResult.positives },
                        { title: "Issues / Risks", items: reviewResult.issues },
                        { title: "Conceptual improvements", items: reviewResult.improvements },
                        { title: "Thinking questions", items: reviewResult.questions },
                      ].map((section) => (
                        <div
                          key={section.title}
                          className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3"
                        >
                          <h4 className="text-sm font-semibold text-slate-100">{section.title}</h4>
                          <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-300">
                            {section.items.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Run the code review after generating student code.
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === "log" ? (
                <div className="flex flex-col gap-2 text-xs text-slate-300">
                  {runLog.length === 0 ? (
                    <p className="text-xs text-slate-400">Run activity will appear here.</p>
                  ) : (
                    runLog.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-slate-500">{item.timestamp}</span>
                          <span className="text-xs text-slate-200">{item.message}</span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            item.status === "success"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : item.status === "error"
                                ? "bg-rose-500/20 text-rose-200"
                                : item.status === "warning"
                                  ? "bg-amber-500/20 text-amber-200"
                                  : "bg-slate-700/40 text-slate-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
