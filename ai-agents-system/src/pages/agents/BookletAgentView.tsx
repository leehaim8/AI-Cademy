import { useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

type BookletConfig = {
  courseName: string;
  courseNumber?: string;
  sourceType: "Syllabus" | "Slides" | "Both";
  outputLanguage: "Hebrew" | "English";
  tone: "Student-friendly" | "Academic" | "Concise";
  useRag: boolean;
};

type CourseOutline = {
  units: Array<{
    title: string;
    topics: string[];
  }>;
};

type BookletDraft = {
  sections: Array<{
    id: string;
    title: string;
    topicOverview: string;
    keyTerms: string[];
    miniActivity: string;
    summary: string;
  }>;
};

type RunLogItem = {
  id: string;
  timestamp: string;
  status: "info" | "success" | "warning" | "error";
  message: string;
};

type AgentState =
  | "idle"
  | "ingesting"
  | "outline_ready"
  | "drafting"
  | "draft_ready"
  | "error";

type TabKey = "outline" | "draft" | "log" | "export";

const defaultConfig: BookletConfig = {
  courseName: "",
  courseNumber: "",
  sourceType: "Both",
  outputLanguage: "Hebrew",
  tone: "Student-friendly",
  useRag: true,
};

const mockGenerateOutline = async (
  config: BookletConfig,
  files: File[],
): Promise<CourseOutline> => {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const hasFiles = files.length > 0;
  const baseTitle = config.courseName || "Course Booklet";

  return {
    units: [
      {
        title: `Unit 1: Foundations of ${baseTitle}`,
        topics: [
          hasFiles ? "Syllabus framing" : "Course goals",
          "Key vocabulary",
          "Learning outcomes",
        ],
      },
      {
        title: "Unit 2: Core Concepts",
        topics: ["Concept map", "Worked examples", "Mini quiz"],
      },
      {
        title: "Unit 3: Practice + Synthesis",
        topics: ["Case study", "Student activity", "Reflection prompts"],
      },
    ],
  };
};

const mockGenerateDraft = async (
  config: BookletConfig,
  outline: CourseOutline,
): Promise<BookletDraft> => {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const sections = [
    {
      id: "intro",
      title: "Introduction",
      topicOverview: `Welcome to ${config.courseName || "this course"}! This booklet explains the flow of the course and how to prepare.`,
      keyTerms: ["Learning objectives", "Assessment", "Resources"],
      miniActivity: "Write down two questions you want answered by the end of the course.",
      summary: "You now have a roadmap and a clear starting point.",
    },
  ];

  outline.units.forEach((unit, index) => {
    sections.push({
      id: `unit-${index + 1}`,
      title: unit.title,
      topicOverview: `This unit focuses on ${unit.topics.join(", ").toLowerCase()}.`,
      keyTerms: unit.topics.slice(0, 3),
      miniActivity: "Summarize the most important idea in one sentence.",
      summary: "You can now connect the concepts to practical scenarios.",
    });
  });

  return { sections };
};

const mockExport = async (
  type: "pdf" | "docx",
  draft: BookletDraft | null,
): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const baseName = draft ? "course-booklet" : "booklet";
  return `${baseName}.${type}`;
};

export default function BookletAgentView() {
  const [config, setConfig] = useState<BookletConfig>(defaultConfig);
  const [files, setFiles] = useState<File[]>([]);
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [draft, setDraft] = useState<BookletDraft | null>(null);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [activeTab, setActiveTab] = useState<TabKey>("outline");
  const [runLog, setRunLog] = useState<RunLogItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "pdf" | "docx">(null);

  const stepIndex = useMemo(() => {
    if (agentState === "ingesting") return 1;
    if (agentState === "outline_ready") return 2;
    if (agentState === "drafting") return 3;
    if (agentState === "draft_ready") return 3;
    if (agentState === "error") return 1;
    return 0;
  }, [agentState]);

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

  const handleGenerateOutline = async () => {
    setErrorMessage(null);
    setAgentState("ingesting");
    addLog("info", "Ingesting source material");

    try {
      const outlineResult = await mockGenerateOutline(config, files);
      setOutline(outlineResult);
      setAgentState("outline_ready");
      setActiveTab("outline");
      addLog("success", "Outline generated");
    } catch (error) {
      setAgentState("error");
      setErrorMessage("Failed to generate outline. Please retry.");
      addLog("error", "Outline generation failed");
    }
  };

  const handleGenerateDraft = async () => {
    if (!outline) return;
    setErrorMessage(null);
    setAgentState("drafting");
    setActiveTab("draft");
    addLog("info", "Generating draft sections");

    try {
      const draftResult = await mockGenerateDraft(config, outline);
      setDraft(draftResult);
      setAgentState("draft_ready");
      addLog("success", "Draft sections generated");
    } catch (error) {
      setAgentState("error");
      setErrorMessage("Failed to generate draft. Please retry.");
      addLog("error", "Draft generation failed");
    }
  };

  const handleExport = async (type: "pdf" | "docx") => {
    setExporting(type);
    try {
      const filename = await mockExport(type, draft);
      addLog("success", `Export prepared: ${filename}`);
    } catch (error) {
      addLog("error", "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setFiles([]);
    setOutline(null);
    setDraft(null);
    setAgentState("idle");
    setActiveTab("outline");
    setRunLog([]);
    setErrorMessage(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = event.target.files ? Array.from(event.target.files) : [];
    setFiles(nextFiles);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    setFiles(droppedFiles);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      addLog("success", "Section copied to clipboard");
    } catch (error) {
      addLog("warning", "Clipboard copy failed");
    }
  };

  const outlineReady = agentState === "outline_ready" || agentState === "drafting" || agentState === "draft_ready";
  const draftReady = agentState === "draft_ready";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-100">Course Booklet Agent</h2>
              <p className="text-sm text-slate-300">
                Builds a coherent course booklet from syllabus and slides (outline → sections → export).
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-100">Inputs</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Course name
                  <input
                    value={config.courseName}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, courseName: event.target.value }))
                    }
                    placeholder="Intro to AI"
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Course number (optional)
                  <input
                    value={config.courseNumber}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, courseNumber: event.target.value }))
                    }
                    placeholder="CS-340"
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Source type
                  <select
                    value={config.sourceType}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        sourceType: event.target.value as BookletConfig["sourceType"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="Syllabus">Syllabus</option>
                    <option value="Slides">Slides</option>
                    <option value="Both">Both</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Output language
                  <select
                    value={config.outputLanguage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        outputLanguage: event.target.value as BookletConfig["outputLanguage"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="Hebrew">Hebrew</option>
                    <option value="English">English</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Tone
                  <select
                    value={config.tone}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        tone: event.target.value as BookletConfig["tone"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="Student-friendly">Student-friendly</option>
                    <option value="Academic">Academic</option>
                    <option value="Concise">Concise</option>
                  </select>
                </label>
                <div className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Use RAG (recommended)
                  <label className="flex items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={config.useRag}
                      onChange={(event) =>
                        setConfig((prev) => ({ ...prev, useRag: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-slate-200"
                    />
                    <span>{config.useRag ? "Enabled" : "Disabled"}</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                Upload sources
                <div
                  onDrop={handleDrop}
                  onDragOver={(event) => event.preventDefault()}
                  className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-4 text-sm text-slate-400"
                >
                  <label className="flex cursor-pointer flex-col gap-2">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <span>Drag & drop files or click to browse.</span>
                    {files.length > 0 ? (
                      <div className="flex flex-col gap-1 text-xs text-slate-300">
                        {files.map((file) => (
                          <span key={file.name} className="truncate">
                            {file.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Accepted: PDF, PPTX, DOCX (mocked)
                      </span>
                    )}
                  </label>
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  <div className="flex items-center justify-between gap-3">
                    <span>{errorMessage}</span>
                    <button
                      onClick={handleGenerateOutline}
                      className="rounded-lg border border-rose-400/60 px-2 py-1 text-xs text-rose-100 hover:border-rose-300"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleGenerateOutline}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white"
                  disabled={agentState === "ingesting" || agentState === "drafting"}
                >
                  {agentState === "ingesting" ? "Generating..." : "Generate outline"}
                </button>
                <button
                  onClick={handleGenerateDraft}
                  disabled={!outlineReady || agentState === "drafting"}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {agentState === "drafting" ? "Drafting..." : "Generate booklet sections"}
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
                  { label: "1. Ingest & Extract", index: 1 },
                  { label: "2. Outline", index: 2 },
                  { label: "3. Booklet Draft + Export", index: 3 },
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
                  { key: "outline", label: "Outline" },
                  { key: "draft", label: "Booklet Draft" },
                  { key: "log", label: "Run Log" },
                  { key: "export", label: "Export" },
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

              {activeTab === "outline" ? (
                <div className="flex flex-col gap-3 text-sm text-slate-200">
                  {agentState === "ingesting" ? (
                    <div className="space-y-3">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800/80" />
                      <div className="h-3 w-full animate-pulse rounded bg-slate-800/60" />
                      <div className="h-3 w-5/6 animate-pulse rounded bg-slate-800/60" />
                    </div>
                  ) : outline ? (
                    outline.units.map((unit) => (
                      <div key={unit.title} className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
                        <h4 className="text-sm font-semibold text-slate-100">{unit.title}</h4>
                        <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-300">
                          {unit.topics.map((topic) => (
                            <li key={topic}>• {topic}</li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">
                      Generate an outline to see the structured course plan.
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === "draft" ? (
                <div className="flex flex-col gap-3">
                  {agentState === "drafting" ? (
                    <div className="space-y-3">
                      <div className="h-5 w-1/2 animate-pulse rounded bg-slate-800/80" />
                      <div className="h-20 w-full animate-pulse rounded bg-slate-800/60" />
                      <div className="h-20 w-full animate-pulse rounded bg-slate-800/60" />
                    </div>
                  ) : draft ? (
                    draft.sections.map((section) => (
                      <div
                        key={section.id}
                        className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3 text-xs text-slate-200"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-slate-100">{section.title}</h4>
                          <button
                            onClick={() =>
                              handleCopy(
                                [
                                  section.title,
                                  section.topicOverview,
                                  `Key terms: ${section.keyTerms.join(", ")}`,
                                  `Activity: ${section.miniActivity}`,
                                  `Summary: ${section.summary}`,
                                ].join("\n"),
                              )
                            }
                            className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-500"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="mt-2 text-slate-300">{section.topicOverview}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {section.keyTerms.map((term) => (
                            <span key={term} className="rounded-full border border-slate-700 px-2 py-0.5">
                              {term}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-300">
                          <span className="font-semibold text-slate-100">Mini activity:</span> {section.miniActivity}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-300">
                          <span className="font-semibold text-slate-100">Summary:</span> {section.summary}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">
                      Generate draft sections after the outline is ready.
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

              {activeTab === "export" ? (
                <div className="flex flex-col gap-3 text-xs text-slate-300">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleExport("pdf")}
                      disabled={!draftReady || exporting !== null}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exporting === "pdf" ? "Preparing..." : "Download as PDF (mock)"}
                    </button>
                    <button
                      onClick={() => handleExport("docx")}
                      disabled={!draftReady || exporting !== null}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exporting === "docx" ? "Preparing..." : "Download as DOCX (mock)"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Export is mocked for now — wiring will come later.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
