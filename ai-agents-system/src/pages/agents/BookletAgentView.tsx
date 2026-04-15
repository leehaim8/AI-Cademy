import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import jsPDF from "jspdf";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  generateBookletChapter,
  generateBookletOutline,
  generateBookletOutlineWithFile,
  type BookletOutlineUnit,
  type SyllabusWeek,
} from "../../lib/api";
import {
  clearBookletTransfer,
  loadBookletTransfer,
} from "../../lib/agentTransferStore";
import { useCourse } from "../../hooks/useCourse";
import {
  enableAgentForCourse,
  getAgentAvailability,
} from "../../lib/courseStore";
import { createRun, createSession } from "../../lib/sessionStore";
import type { SessionRun } from "../../types/course";

type BookletConfig = {
  courseName: string;
  courseNumber?: string;
  outputLanguage: "Hebrew" | "English";
  tone: "Student-friendly" | "Academic" | "Concise";
};

type BookletChapter = {
  id: string;
  title: string;
  draftMd: string;
  finalMd: string;
  createdAt: string;
};

type AgentState =
  | "idle"
  | "ingesting"
  | "outline_ready"
  | "drafting"
  | "draft_ready"
  | "error";

type TabKey = "outline" | "chapter" | "export";

type BookletLocationState = {
  fromSyllabusAgent?: boolean;
  weeks?: SyllabusWeek[];
  topics?: string[];
  audience?: string;
  constraints?: string;
};

const defaultConfig: BookletConfig = {
  courseName: "",
  courseNumber: "",
  outputLanguage: "English",
  tone: "Academic",
};

type BookletAgentViewProps = {
  selectedRun?: SessionRun | null;
  onClearSelectedRun?: () => void;
  clearSelectionVersion?: number;
};

function outlineFromSyllabus(weeks: SyllabusWeek[]): BookletOutlineUnit[] {
  return weeks.map((week) => ({
    title: `Week ${week.week}: ${week.central_topic}`,
    topics: week.topics.length > 0 ? week.topics : ["No topics assigned"],
  }));
}

export default function BookletAgentView({
  selectedRun = null,
  onClearSelectedRun: _onClearSelectedRun,
  clearSelectionVersion = 0,
}: BookletAgentViewProps) {
  const { courseId = "", agentKey = "", id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation() as { state?: BookletLocationState };
  const { course } = useCourse(courseId);
  const [config, setConfig] = useState<BookletConfig>(defaultConfig);
  const [files, setFiles] = useState<File[]>([]);
  const [syllabusText, setSyllabusText] = useState<string>("");
  const [outline, setOutline] = useState<BookletOutlineUnit[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, unknown> | null>(null);
  const [chapters, setChapters] = useState<BookletChapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [activeTab, setActiveTab] = useState<TabKey>("outline");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [useImportedSyllabus, setUseImportedSyllabus] = useState<boolean>(true);
  const [stageStartedAt, setStageStartedAt] = useState<number | null>(null);
  const [stageNow, setStageNow] = useState<number>(Date.now());
  const activeAgentKey = agentKey || id || "booklet";
  const didInitReset = useRef(false);
  const lastImportedSignatureRef = useRef<string | null>(null);
  const routeTransfer =
    location.state?.fromSyllabusAgent &&
    Array.isArray(location.state?.weeks) &&
    location.state.weeks.length > 0
      ? location.state
      : null;
  const storedTransfer = useMemo(
    () => (courseId ? loadBookletTransfer(courseId) : null),
    [courseId],
  );
  const effectiveTransfer = useMemo(
    () =>
      routeTransfer
        ? {
            weeks: routeTransfer.weeks ?? [],
            topics: routeTransfer.topics ?? [],
            audience: routeTransfer.audience ?? "",
            constraints: routeTransfer.constraints ?? "",
          }
        : storedTransfer
          ? {
              weeks: storedTransfer.weeks,
              topics: storedTransfer.topics,
              audience: storedTransfer.audience,
              constraints: storedTransfer.constraints,
            }
          : null,
    [routeTransfer, storedTransfer],
  );
  const importedFromSyllabus = Boolean(effectiveTransfer);
  const canUseImported = importedFromSyllabus && useImportedSyllabus;

  const importedWeeks = useMemo(
    () =>
      canUseImported && Array.isArray(effectiveTransfer?.weeks)
        ? effectiveTransfer.weeks
        : [],
    [effectiveTransfer, canUseImported],
  );
  const importedTopics = useMemo(
    () =>
      canUseImported && Array.isArray(effectiveTransfer?.topics)
        ? effectiveTransfer.topics.filter(Boolean)
        : [],
    [effectiveTransfer, canUseImported],
  );
  const importedOutline = useMemo(
    () => (importedWeeks.length > 0 ? outlineFromSyllabus(importedWeeks) : []),
    [importedWeeks],
  );
  const importedWeeksSignature = useMemo(
    () => JSON.stringify(importedWeeks),
    [importedWeeks],
  );

  const stepIndex = useMemo(() => {
    if (agentState === "ingesting") return 1;
    if (agentState === "outline_ready") return 2;
    if (agentState === "drafting") return 3;
    if (agentState === "draft_ready") return 3;
    if (agentState === "error") return 1;
    return 0;
  }, [agentState]);

  const progressMeta = useMemo(() => {
    if (!stageStartedAt) {
      return null;
    }

    const stageConfig =
      agentState === "ingesting"
        ? {
            label: "Building outline",
            description: "Mapping the syllabus into course structure.",
            estimateMs: 18000,
          }
        : agentState === "drafting"
          ? {
              label: "Generating chapter",
              description: "Writing and aligning the chapter draft.",
              estimateMs: 90000,
            }
          : null;

    if (!stageConfig) {
      return null;
    }

    const elapsedMs = Math.max(0, stageNow - stageStartedAt);
    const ratio = Math.min(elapsedMs / stageConfig.estimateMs, 0.96);
    const remainingMs = Math.max(stageConfig.estimateMs - elapsedMs, 0);

    return {
      ...stageConfig,
      percent: Math.max(8, Math.round(ratio * 100)),
      remainingSeconds: Math.ceil(remainingMs / 1000),
    };
  }, [agentState, stageNow, stageStartedAt]);

  const activeChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === activeChapterId) ?? null,
    [activeChapterId, chapters],
  );
  const effectiveOutline = outline.length > 0 ? outline : importedOutline;

  const handleGenerateOutline = async () => {
    setErrorMessage(null);
    setOutlineError(null);
    setAgentState("ingesting");
    setStageStartedAt(Date.now());

    try {
      let response;
      if (files.length > 0) {
        response = await generateBookletOutlineWithFile(
          files[0],
          config.courseName,
        );
      } else if (syllabusText.trim()) {
        response = await generateBookletOutline({
          syllabus_text: syllabusText.trim(),
          course_name: config.courseName,
        });
      } else if (importedWeeks.length > 0) {
        response = await generateBookletOutline({
          weeks: importedWeeks,
          course_name: config.courseName,
        });
      } else {
        throw new Error(
          "Add a syllabus file, paste syllabus text, or import weeks from the Syllabus Flow Agent.",
        );
      }

      setOutline(response.outline ?? []);
      setCourseMap(response.course_map ?? null);
      setAgentState("outline_ready");
      setStageStartedAt(null);
      setActiveTab("outline");
      setSelectedChapter(
        response.outline?.[0]?.title ?? selectedChapter ?? "",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate outline.";
      setAgentState("error");
      setStageStartedAt(null);
      setOutlineError(message);
      setErrorMessage(message);
    }
  };

  const handleGenerateChapter = async () => {
    if (!courseMap) {
      setChapterError("Generate an outline first so the course map is ready.");
      return;
    }
    if (!selectedChapter) {
      setChapterError("Select a chapter from the outline.");
      return;
    }

    setChapterError(null);
    setAgentState("drafting");
    setStageStartedAt(Date.now());
    setActiveTab("chapter");

    try {
      const result = await generateBookletChapter({
        chapter_name: selectedChapter,
        course_map: courseMap,
        output_language: config.outputLanguage,
        tone: config.tone,
      });
      const chapter: BookletChapter = {
        id: crypto.randomUUID(),
        title: result.chapter_name,
        draftMd: result.draft_md,
        finalMd: result.final_md,
        createdAt: new Date().toLocaleTimeString(),
      };
      setChapters((prev) => [chapter, ...prev]);
      setActiveChapterId(chapter.id);
      setAgentState("draft_ready");
      setStageStartedAt(null);

      if (courseId) {
        const timestampLabel = new Date().toLocaleString();
        const fileName =
          files.length > 0 ? files[0]?.name || "Unknown file" : "None";
        const sessionTitle = `Chapter: ${result.chapter_name} · ${timestampLabel} · ${fileName}`;
        const notes = [
          config.courseName ? `Course: ${config.courseName}` : "",
          `Language: ${config.outputLanguage}`,
          `Tone: ${config.tone}`,
          `Timestamp: ${timestampLabel}`,
          `File: ${fileName}`,
        ]
          .filter(Boolean)
          .join(" · ");
        const session = await createSession(courseId, activeAgentKey, sessionTitle, notes);
        await createRun(
          session.id,
          {
            course_name: config.courseName || undefined,
            chapter_name: result.chapter_name,
            output_language: config.outputLanguage,
            tone: config.tone,
            source: files.length
              ? "upload"
              : syllabusText.trim()
                ? "text"
                : importedWeeks.length
                  ? "weeks"
                  : "unknown",
            timestamp: timestampLabel,
            uploaded_file: files.length > 0 ? files[0]?.name || "" : "",
            outline: effectiveOutline,
          },
          {
            chapter_title: result.chapter_name,
            draft_md: result.draft_md,
            final_md: result.final_md,
            course_map: courseMap,
          },
          "success",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate chapter.";
      setAgentState("error");
      setStageStartedAt(null);
      setChapterError(message);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setFiles([]);
    setSyllabusText("");
    setOutline([]);
    setCourseMap(null);
    setChapters([]);
    setActiveChapterId(null);
    setAgentState("idle");
    setActiveTab("outline");
    setErrorMessage(null);
    setOutlineError(null);
    setChapterError(null);
    setSelectedChapter("");
    setUseImportedSyllabus(true);
    setStageStartedAt(null);
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
    } catch {
      setErrorMessage("Clipboard copy failed.");
    }
  };

  const handleToggleImported = (nextValue: boolean) => {
    setUseImportedSyllabus(nextValue);

    if (!nextValue) {
      setOutline([]);
      setCourseMap(null);
      setAgentState("idle");
      setActiveTab("outline");
      setOutlineError(null);
      setErrorMessage(null);
      setSelectedChapter("");
      lastImportedSignatureRef.current = null;
      return;
    }

    lastImportedSignatureRef.current = null;
  };

  const handleSendToHomework = (chapter: BookletChapter) => {
    const chapterText = chapter.finalMd || chapter.draftMd;

    if (courseId) {
      const availability = getAgentAvailability(courseId);
      if (!availability.homework) {
        const shouldEnable = window.confirm(
          "Homework Generator is not added to this course yet. Do you want to add it now?",
        );
        if (!shouldEnable) {
          return;
        }
        enableAgentForCourse(courseId, "homework");
      }
    }

    navigate(
      courseId ? `/courses/${courseId}/agents/homework` : "/agent/homework",
      {
        state: {
          fromBookletAgent: true,
          chapterText,
          chapterTitle: chapter.title,
        },
      },
    );
  };

  const handleDownloadPdf = (chapter: BookletChapter) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginLeft = 48;
    const marginTop = 54;
    const lineHeight = 16;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginLeft * 2;
    let y = marginTop;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(chapter.title, marginLeft, y);
    y += lineHeight * 1.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const content = (chapter.finalMd || chapter.draftMd).replace(/\r\n/g, "\n");
    const lines = doc.splitTextToSize(content, contentWidth);

    lines.forEach((line: string) => {
      if (y > pageHeight - marginTop) {
        doc.addPage();
        y = marginTop;
      }
      doc.text(line, marginLeft, y);
      y += lineHeight;
    });

    const safeName = chapter.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80);
    doc.save(`${safeName || "chapter"}.pdf`);
  };

  useEffect(() => {
    if (agentState !== "ingesting" && agentState !== "drafting") {
      return;
    }

    const interval = window.setInterval(() => {
      setStageNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [agentState]);

  useEffect(() => {
    if (!canUseImported || importedWeeks.length === 0) {
      return;
    }
    if (lastImportedSignatureRef.current === importedWeeksSignature) {
      return;
    }
    lastImportedSignatureRef.current = importedWeeksSignature;

    setConfig((prev) => ({
      ...prev,
      courseName: prev.courseName || course?.name || "",
    }));
    setFiles([]);
    setOutline(outlineFromSyllabus(importedWeeks));
    setCourseMap(null);
    setAgentState("outline_ready");
    setActiveTab("outline");
    setOutlineError(null);
    setErrorMessage(null);
    if (courseId) {
      clearBookletTransfer(courseId);
    }
  }, [
    course?.name,
    courseId,
    canUseImported,
    importedWeeks,
    importedWeeksSignature,
  ]);

  useEffect(() => {
    if (!selectedChapter && effectiveOutline.length > 0) {
      setSelectedChapter(effectiveOutline[0].title);
    }
  }, [effectiveOutline, selectedChapter]);

  useEffect(() => {
    if (!selectedRun) {
      return;
    }

    const inputData =
      selectedRun.input_data && typeof selectedRun.input_data === "object"
        ? (selectedRun.input_data as {
            course_name?: string;
            chapter_name?: string;
            output_language?: string;
            tone?: string;
            outline?: BookletOutlineUnit[];
          })
        : null;

    const outputData =
      selectedRun.output_data && typeof selectedRun.output_data === "object"
        ? (selectedRun.output_data as {
            chapter_title?: string;
            draft_md?: string;
            final_md?: string;
            course_map?: Record<string, unknown>;
          })
        : null;

    if (typeof inputData?.course_name === "string") {
      setConfig((prev) => ({ ...prev, courseName: inputData.course_name || "" }));
    }
    if (typeof inputData?.output_language === "string") {
      setConfig((prev) => ({
        ...prev,
        outputLanguage: inputData.output_language as BookletConfig["outputLanguage"],
      }));
    }
    if (typeof inputData?.tone === "string") {
      setConfig((prev) => ({
        ...prev,
        tone: inputData.tone as BookletConfig["tone"],
      }));
    }
    if (Array.isArray(inputData?.outline)) {
      setOutline(inputData.outline);
    }

    if (outputData?.course_map) {
      setCourseMap(outputData.course_map);
    }

    if (outputData?.final_md || outputData?.draft_md) {
      const chapterTitle =
        outputData.chapter_title || inputData?.chapter_name || "Chapter";
      const chapter: BookletChapter = {
        id: crypto.randomUUID(),
        title: chapterTitle,
        draftMd: outputData.draft_md || "",
        finalMd: outputData.final_md || "",
        createdAt: new Date(selectedRun.created_at).toLocaleTimeString(),
      };
      setChapters([chapter]);
      setActiveChapterId(chapter.id);
      setAgentState("draft_ready");
      setActiveTab("chapter");
    }
  }, [selectedRun]);

  useEffect(() => {
    if (!didInitReset.current) {
      didInitReset.current = true;
      return;
    }

    setConfig(defaultConfig);
    setFiles([]);
    setSyllabusText("");
    setOutline([]);
    setCourseMap(null);
    setChapters([]);
    setActiveChapterId(null);
    setAgentState("idle");
    setActiveTab("outline");
    setErrorMessage(null);
    setOutlineError(null);
    setChapterError(null);
    setSelectedChapter("");
    setUseImportedSyllabus(true);
    setStageStartedAt(null);
    lastImportedSignatureRef.current = null;
  }, [clearSelectionVersion]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-100">
                Course Booklet Generator
              </h2>
              <p className="text-sm text-slate-300">
                Generate structured chapters from your syllabus, then send them
                to the Homework Generator
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-100">Inputs</h3>

              {importedFromSyllabus ? (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-xs text-violet-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Imported from Syllabus Flow Agent</p>
                      <p className="mt-1 text-violet-200/90">
                        {canUseImported
                          ? `Loaded ${importedWeeks.length} weeks and ${importedTopics.length} topics into the outline preview`
                          : "Import is available, but currently disabled"}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-violet-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-violet-400"
                        checked={useImportedSyllabus}
                        onChange={(event) => handleToggleImported(event.target.checked)}
                      />
                      Use imported syllabus
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Course name
                  <input
                    value={config.courseName}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        courseName: event.target.value,
                      }))
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
                      setConfig((prev) => ({
                        ...prev,
                        courseNumber: event.target.value,
                      }))
                    }
                    placeholder="CS-340"
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                  Output language
                  <select
                    value={config.outputLanguage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        outputLanguage: event.target
                          .value as BookletConfig["outputLanguage"],
                      }))
                    }
                    className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="Hebrew">Hebrew</option>
                    <option value="English">English</option>
                  </select>
                </label>
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
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-sky-400/60 bg-sky-500/10 px-3 py-2 text-xs text-sky-100 md:col-span-2">
                  <p className="text-sky-100 font-semibold">Syllabus sources</p>
                  <p className="mt-1 text-sky-100/90">
                    Use weeks from the Syllabus Flow Agent, upload a file, or paste
                    the syllabus text
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                Upload syllabus
                <div
                  onDrop={handleDrop}
                  onDragOver={(event) => event.preventDefault()}
                  className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-4 text-sm text-slate-400"
                >
                  <label className="flex cursor-pointer flex-col gap-2">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <span>Drag and drop a syllabus file or click to browse.</span>
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
                        Accepted: PDF, DOCX, TXT, MD
                      </span>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                Or paste syllabus text
                <textarea
                  value={syllabusText}
                  onChange={(event) => setSyllabusText(event.target.value)}
                  placeholder="Week 1: Central Topic: ... "
                  className="min-h-[120px] w-full resize-y rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-slate-500"
                />
              </div>

              {outlineError ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {outlineError}
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
              <h3 className="text-sm font-semibold text-slate-100">
                Chapter generation
              </h3>
              <div className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                Select chapter
                <select
                  value={selectedChapter}
                  onChange={(event) => setSelectedChapter(event.target.value)}
                  className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  disabled={effectiveOutline.length === 0}
                >
                  {effectiveOutline.length === 0 ? (
                    <option value="">Generate an outline first</option>
                  ) : (
                    effectiveOutline.map((unit) => (
                      <option key={unit.title} value={unit.title}>
                        {unit.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {chapterError ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {chapterError}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleGenerateChapter}
                  disabled={effectiveOutline.length === 0 || agentState === "drafting"}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {agentState === "drafting" ? "Drafting..." : "Generate chapter"}
                </button>
                <span className="text-[11px] text-slate-500">
                  Output language: {config.outputLanguage} · Tone: {config.tone}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-100">Progress</h3>
              {progressMeta ? (
                <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-sky-100">
                        {progressMeta.label}
                      </p>
                      <p className="mt-1 text-xs text-sky-100/80">
                        {progressMeta.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-sky-100/90">
                      About {progressMeta.remainingSeconds}s left
                    </div>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-950/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${progressMeta.percent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-sky-100/75">
                    This is an approximate progress estimate
                  </p>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 text-xs text-slate-300">
                {[
                  { label: "1. Ingest & Map", index: 1 },
                  { label: "2. Outline", index: 2 },
                  { label: "3. Chapter Draft", index: 3 },
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
                  { key: "chapter", label: "Chapter Draft" },
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
                  ) : effectiveOutline.length > 0 ? (
                    effectiveOutline.map((unit) => (
                      <div
                        key={unit.title}
                        className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3"
                      >
                        <h4 className="text-sm font-semibold text-slate-100">
                          {unit.title}
                        </h4>
                        <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-300">
                          {unit.topics.map((topic) => (
                            <li key={topic} className="flex items-start gap-2">
                              <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-500" />
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">
                      Generate an outline to see the structured course plan
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === "chapter" ? (
                <div className="flex flex-col gap-3">
                  {agentState === "drafting" ? (
                    <div className="space-y-3">
                      <div className="h-5 w-1/2 animate-pulse rounded bg-slate-800/80" />
                      <div className="h-20 w-full animate-pulse rounded bg-slate-800/60" />
                      <div className="h-20 w-full animate-pulse rounded bg-slate-800/60" />
                    </div>
                  ) : activeChapter ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100">
                            {activeChapter.title}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Generated at {activeChapter.createdAt}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              handleCopy(
                                activeChapter.finalMd || activeChapter.draftMd,
                              )
                            }
                            className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-500"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => handleSendToHomework(activeChapter)}
                            className="rounded-lg border border-emerald-500/60 px-2 py-1 text-[11px] text-emerald-200 hover:border-emerald-400"
                          >
                            Send to Homework Generator
                          </button>
                        </div>
                      </div>

                      <div className="booklet-scroll max-h-[60vh] overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-xs text-slate-200 shadow-inner shadow-black/40">
                        <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-200">
                          {activeChapter.finalMd || activeChapter.draftMd}
                        </pre>
                      </div>

                      {chapters.length > 1 ? (
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {chapters.map((chapter) => (
                            <button
                              key={chapter.id}
                              onClick={() => setActiveChapterId(chapter.id)}
                              className={`rounded-full border px-3 py-1 ${
                                chapter.id === activeChapterId
                                  ? "border-slate-200 bg-slate-200 text-slate-900"
                                  : "border-slate-700 text-slate-300 hover:border-slate-500"
                              }`}
                            >
                              {chapter.title}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Generate a chapter after the outline is ready
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === "export" ? (
                <div className="flex flex-col gap-3 text-xs text-slate-300">
                  {activeChapter ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleDownloadPdf(activeChapter)}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500"
                      >
                        Download PDF
                      </button>
                      <button
                        onClick={() => handleSendToHomework(activeChapter)}
                        className="rounded-xl border border-emerald-500/60 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-400"
                      >
                        Send to Homework Generator
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
                      Export will be available after chapter generation
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {errorMessage ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
