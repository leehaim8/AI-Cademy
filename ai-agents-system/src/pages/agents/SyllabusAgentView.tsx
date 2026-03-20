import { useMemo, useState, type SyntheticEvent } from "react";
import jsPDF from "jspdf";
import { useLocation, useParams } from "react-router-dom";
import { generateSyllabus, type SyllabusWeek } from "../../lib/api";
import { getCurrentUser } from "../../lib/authStorage";
import { createRun, createSession } from "../../lib/sessionStore";
import aiCademyLogo from "../../assets/ai-cademy-logo.svg";

type TopicSourceMode = "paste" | "manual";

function normalizeTopics(raw: string): string[] {
  return raw
    .split(/\n|,|;/)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

export default function SyllabusAgentView() {
  const { courseId = "", agentKey = "" } = useParams();
  const currentUser = getCurrentUser();
  const instructorName = currentUser?.full_name ?? "";
  const location = useLocation() as {
    state?: { fromTopicAgent?: boolean; topics?: string[] };
  };

  const initialFromTopic = Boolean(
    location.state?.fromTopicAgent &&
      Array.isArray(location.state.topics) &&
      location.state.topics.length > 0,
  );
  const initialImportedTopics = initialFromTopic
    ? (location.state?.topics ?? []).filter(Boolean)
    : [];

  const [mode, setMode] = useState<TopicSourceMode>(
    initialFromTopic ? "paste" : "manual",
  );
  const [pastedTopics, setPastedTopics] = useState(
    initialImportedTopics.join("\n"),
  );
  const [manualTopic, setManualTopic] = useState("");
  const [manualTopics, setManualTopics] = useState<string[]>([]);
  const [weeks, setWeeks] = useState(12);
  const [audience, setAudience] = useState("University students");
  const [constraints, setConstraints] = useState(
    "Prefer foundations before advanced topics.",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weekPlan, setWeekPlan] = useState<SyllabusWeek[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");

  const parsedPastedTopics = useMemo(
    () => normalizeTopics(pastedTopics),
    [pastedTopics],
  );

  const topics = useMemo(
    () => [...parsedPastedTopics, ...manualTopics],
    [parsedPastedTopics, manualTopics],
  );

  const handleAddManualTopic = () => {
    const value = manualTopic.trim();
    if (!value) return;
    setManualTopics((prev) => [...prev, value]);
    setManualTopic("");
  };

  const handleRemoveManualTopic = (index: number) => {
    setManualTopics((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (topics.length === 0) return;

    setHasGenerated(true);
    setIsGenerating(true);
    setErrorMessage(null);
    setSaveMessage(null);
    setSaveState("idle");

    try {
      const result = await generateSyllabus({
        topics,
        num_weeks: weeks,
        audience: audience.trim() || "University students",
        constraints: constraints.trim() || undefined,
      });
      setWeekPlan(result.weeks ?? []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not generate the syllabus right now.";
      setWeekPlan([]);
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (weekPlan.length === 0) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const buildDocument = (logoDataUrl?: string) => {
      const marginLeft = 56;
      const marginTop = 56;
      const lineHeight = 18;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - marginLeft * 2;
      const centerX = pageWidth / 2;

      let y = marginTop;

      if (logoDataUrl) {
        try {
          const logoWidth = 80;
          const logoHeight = 80;
          const logoX = centerX - logoWidth / 2;
          doc.addImage(logoDataUrl, "PNG", logoX, y, logoWidth, logoHeight);
          y += logoHeight + 26;
        } catch {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(22);
          doc.setTextColor(56, 189, 248);
          doc.text("AI CADEMY", centerX, y + 10, { align: "center" });
          y += lineHeight * 2;
        }
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(56, 189, 248);
        doc.text("AI CADEMY", centerX, y, { align: "center" });
        y += lineHeight * 2;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("AI CADEMY", centerX, y, { align: "center" });
      y += lineHeight * 1.2;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(
        instructorName
          ? `Instructor: ${instructorName}`
          : "Instructor: __________________",
        centerX,
        y,
        { align: "center" },
      );

      const today = new Date();
      doc.text(`Generated: ${today.toLocaleDateString()}`, centerX, y + lineHeight, {
        align: "center",
      });

      y += lineHeight * 3;

      const tableTop = y;
      const tableHeaderHeight = 24;
      const columnHeaderHeight = 20;
      const colWeekWidth = 60;
      const colThemeWidth = 180;
      const colTopicWidth = Math.max(
        120,
        contentWidth - colWeekWidth - colThemeWidth,
      );

      doc.setFillColor(15, 23, 42);
      doc.setTextColor(248, 250, 252);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.rect(marginLeft, tableTop, contentWidth, tableHeaderHeight, "F");
      doc.text("Course Structure", marginLeft + contentWidth / 2, tableTop + 16, {
        align: "center",
      });

      y = tableTop + tableHeaderHeight;

      const drawColumnHeaders = (rowY: number) => {
        doc.setFillColor(241, 245, 249);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.rect(marginLeft, rowY, contentWidth, columnHeaderHeight, "F");
        doc.text("Week", marginLeft + 6, rowY + 13);
        doc.text("Theme", marginLeft + colWeekWidth + 6, rowY + 13);
        doc.text(
          "Topics",
          marginLeft + colWeekWidth + colThemeWidth + 6,
          rowY + 13,
        );
      };

      drawColumnHeaders(y);
      y += columnHeaderHeight;

      const rows = weekPlan.flatMap((week) => {
        if (week.topics.length === 0) {
          return [
            {
              week: week.week,
              centralTopic: week.central_topic,
              topic: "(no topics assigned yet)",
            },
          ];
        }

        return week.topics.map((topic, index) => ({
          week: index === 0 ? week.week : "",
          centralTopic: index === 0 ? week.central_topic : "",
          topic,
        }));
      });

      const drawHeaderOnNewPage = () => {
        const headerTop = marginTop;
        doc.setFillColor(15, 23, 42);
        doc.setTextColor(248, 250, 252);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.rect(marginLeft, headerTop, contentWidth, tableHeaderHeight, "F");
        doc.text(
          "Course Structure (cont.)",
          marginLeft + contentWidth / 2,
          headerTop + 16,
          { align: "center" },
        );

        const headerY = headerTop + tableHeaderHeight;
        drawColumnHeaders(headerY);
        return headerY + columnHeaderHeight;
      };

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      rows.forEach((row) => {
        const themeLines = doc.splitTextToSize(row.centralTopic || " ", colThemeWidth - 12);
        const topicLines = doc.splitTextToSize(row.topic, colTopicWidth - 12);
        const rowLineCount = Math.max(1, themeLines.length, topicLines.length);
        const rowHeight = Math.max(20, rowLineCount * 13 + 8);

        if (y > pageHeight - marginTop - rowHeight) {
          doc.addPage();
          y = drawHeaderOnNewPage();
        }

        doc.setDrawColor(148, 163, 184);
        doc.rect(marginLeft, y, colWeekWidth, rowHeight);
        doc.rect(marginLeft + colWeekWidth, y, colThemeWidth, rowHeight);
        doc.rect(
          marginLeft + colWeekWidth + colThemeWidth,
          y,
          colTopicWidth,
          rowHeight,
        );

        doc.setTextColor(15, 23, 42);
        doc.text(String(row.week), marginLeft + 6, y + 13);
        doc.text(themeLines, marginLeft + colWeekWidth + 6, y + 13);
        doc.text(
          topicLines,
          marginLeft + colWeekWidth + colThemeWidth + 6,
          y + 13,
        );

        y += rowHeight;
      });

      doc.save("ai-cademy-syllabus.pdf");
    };

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 96;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          buildDocument(canvas.toDataURL("image/png"));
        } else {
          buildDocument();
        }
      } catch {
        buildDocument();
      }
    };
    img.onerror = () => buildDocument();
    img.src = aiCademyLogo;
  };

  const handleSaveOutput = () => {
    if (!courseId || !agentKey) {
      setSaveState("error");
      setSaveMessage("Course context is missing, so the syllabus could not be saved.");
      return;
    }

    if (weekPlan.length === 0) {
      setSaveState("error");
      setSaveMessage("Generate a syllabus before saving it.");
      return;
    }

    const timestamp = new Date();
    const sessionTitle = `Syllabus ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    const notesParts = [
      `Audience: ${audience.trim() || "University students"}`,
      constraints.trim() ? `Constraints: ${constraints.trim()}` : "",
    ].filter(Boolean);

    const session = createSession(
      courseId,
      agentKey,
      sessionTitle,
      notesParts.join("\n"),
    );

    createRun(
      session.id,
      {
        topics,
        num_weeks: weeks,
        audience: audience.trim() || "University students",
        constraints: constraints.trim() || null,
      },
      {
        weeks: weekPlan,
      },
      "success",
    );

    setSaveState("success");
    setSaveMessage("Syllabus output saved to session history.");
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
      <form
        onSubmit={handleGenerate}
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-sm font-semibold text-slate-100">
            Syllabus input
          </h2>
          <span className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            Step 1 · Choose topics & weeks
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-200">
              Topics
            </p>

            {initialFromTopic ? (
              <>
                <div className="mb-2 inline-flex rounded-full bg-slate-900/80 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setMode("paste")}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      mode === "paste"
                        ? "bg-sky-500 text-slate-50"
                        : "text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    From Topic Extraction Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("manual")}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      mode === "manual"
                        ? "bg-sky-500 text-slate-50"
                        : "text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    Add more topics
                  </button>
                </div>

                {mode === "paste" ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                      <span>Imported topics</span>
                      <span className="text-slate-500">
                        Loaded from the Topic Extraction Agent.
                      </span>
                    </div>
                    <textarea
                      value={pastedTopics}
                      onChange={(e) => setPastedTopics(e.target.value)}
                      className="min-h-[120px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                      <span>Additional topics</span>
                      <span className="text-slate-500">
                        Add any extra ideas you want to cover.
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualTopic}
                        onChange={(e) => setManualTopic(e.target.value)}
                        placeholder="Type a topic and press +"
                        className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                      />
                      <button
                        type="button"
                        onClick={handleAddManualTopic}
                        className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(56,189,248,0.5)] hover:bg-sky-400"
                      >
                        +
                      </button>
                    </div>
                    {manualTopics.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-200">
                        {manualTopics.map((topic, index) => (
                          <li
                            key={`${topic}-${index}`}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-0.5"
                          >
                            <span className="max-w-[10rem] truncate" title={topic}>
                              {topic}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveManualTopic(index)}
                              className="text-[10px] text-slate-500 hover:text-red-300"
                            >
                              x
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Topics</span>
                  <span className="text-slate-500">
                    Add the main ideas you want to cover.
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualTopic}
                    onChange={(e) => setManualTopic(e.target.value)}
                    placeholder="Type a topic and press +"
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualTopic}
                    className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(56,189,248,0.5)] hover:bg-sky-400"
                  >
                    +
                  </button>
                </div>
                {manualTopics.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-200">
                    {manualTopics.map((topic, index) => (
                      <li
                        key={`${topic}-${index}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-0.5"
                      >
                        <span className="max-w-[10rem] truncate" title={topic}>
                          {topic}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveManualTopic(index)}
                          className="text-[10px] text-slate-500 hover:text-red-300"
                        >
                          x
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-200">
              Audience
            </label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="For example: second-year computer science students"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-200">
              Teaching constraints
            </label>
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="Optional guidance for pacing, foundations, labs, assessment flow, and course priorities."
              className="min-h-[90px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
            />
          </div>

          <div className="flex flex-col gap-1 text-[11px] text-slate-300">
            <div className="flex items-center justify-between">
              <span>Number of weeks</span>
              <span className="text-sky-300 font-semibold">{weeks} weeks</span>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value) || 1)}
              className="w-full cursor-pointer accent-sky-500"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
          <span>{topics.length} topics</span>
          <button
            type="submit"
            disabled={topics.length === 0 || isGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_35px_rgba(16,185,129,0.5)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
          >
            <span>{isGenerating ? "Generating..." : "Generate syllabus layout"}</span>
          </button>
        </div>
      </form>

      <div
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold text-slate-100">
          Week-by-week syllabus
        </h2>

        {!hasGenerated ? (
          <p className="text-xs text-slate-400">
            Choose topics, audience, and number of weeks, then generate a syllabus.
            The backend agent will return a structured weekly teaching plan here.
          </p>
        ) : errorMessage ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errorMessage}
          </div>
        ) : isGenerating ? (
          <p className="text-xs text-slate-400">
            Building prerequisite flow and consolidating weekly themes...
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 max-h-[360px] overflow-y-auto pr-1">
              {weekPlan.map((week) => (
                <div
                  key={week.week}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100">
                      Week {week.week}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {week.topics.length} topics
                    </span>
                  </div>
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-sky-300">
                      Central theme
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-100">
                      {week.central_topic}
                    </p>
                  </div>
                  {week.topics.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No topics assigned.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-[11px] text-slate-200">
                      {week.topics.map((topic, index) => (
                        <li key={`${week.week}-${index}`} className="flex items-start gap-2">
                          <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-400">
              <span>
                Save this result to session history or download a PDF for course
                planning documents.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveOutput}
                  disabled={weekPlan.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:border-sky-400 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                >
                  <span>Save output</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={weekPlan.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                >
                  <span>Download PDF</span>
                </button>
              </div>
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
          </>
        )}
      </div>
    </div>
  );
}
