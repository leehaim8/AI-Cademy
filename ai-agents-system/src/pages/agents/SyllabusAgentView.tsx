import { useMemo, useState, type SyntheticEvent } from "react";
import jsPDF from "jspdf";
import { useLocation } from "react-router-dom";
import { getCurrentUser } from "../../lib/authStorage";
import aiCademyLogo from "../../assets/ai-cademy-logo.svg";

type TopicSourceMode = "paste" | "manual";

type WeekPlan = {
  week: number;
  topics: string[];
};

function buildWeekPlan(topics: string[], weeks: number): WeekPlan[] {
  const cleanTopics = topics.map((t) => t.trim()).filter(Boolean);
  const safeWeeks = Math.max(1, Math.min(52, weeks || 1));

  if (cleanTopics.length === 0) {
    return Array.from({ length: safeWeeks }, (_, i) => ({
      week: i + 1,
      topics: [],
    }));
  }

  const plan: WeekPlan[] = Array.from({ length: safeWeeks }, (_, i) => ({
    week: i + 1,
    topics: [],
  }));

  cleanTopics.forEach((topic, index) => {
    const weekIndex = index % safeWeeks;
    plan[weekIndex].topics.push(topic);
  });

  return plan;
}

export default function SyllabusAgentView() {
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
    ? (location.state!.topics as string[]).filter(Boolean)
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
  const [hasGenerated, setHasGenerated] = useState(false);

  const parsedPastedTopics = useMemo(
    () =>
      pastedTopics
        .split(/\n|,|;/)
        .map((t) => t.trim())
        .filter(Boolean),
    [pastedTopics],
  );

  const topics = useMemo(() => {
    return [...parsedPastedTopics, ...manualTopics];
  }, [parsedPastedTopics, manualTopics]);

  const weekPlan = useMemo(() => buildWeekPlan(topics, weeks), [topics, weeks]);

  const handleGenerate = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasGenerated(true);
  };

  const handleAddManualTopic = () => {
    const value = manualTopic.trim();
    if (!value) return;
    setManualTopics((prev) => [...prev, value]);
    setManualTopic("");
  };

  const handleRemoveManualTopic = (index: number) => {
    setManualTopics((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownloadPdf = () => {
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

      // Optional logo centered at top
      if (logoDataUrl) {
        try {
          const logoWidth = 80;
          const logoHeight = 80;
          const logoX = centerX - logoWidth / 2;
          doc.addImage(logoDataUrl, "PNG", logoX, y, logoWidth, logoHeight);
          y += logoHeight + 26; // extra space between logo and text
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

      // Centered title text under logo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("AI CADEMY", centerX, y, { align: "center" });
      y += lineHeight * 1.2;

      // Centered metadata
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // metadata
      const instructorLabel = instructorName
        ? `Instructor: ${instructorName}`
        : "Instructor: __________________";
      doc.text(instructorLabel, centerX, y, { align: "center" });

      const today = new Date();
      const dateLabel = today.toLocaleDateString();
      doc.text(`Generated: ${dateLabel}`, centerX, y + lineHeight, {
        align: "center",
      });

      y += lineHeight * 3;

      // Table-style course structure header
      const tableTop = y;
      const tableHeaderHeight = 24;
      doc.setFillColor(15, 23, 42); // slate-900 instead of red
      doc.setTextColor(248, 250, 252); // slate-50
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.rect(marginLeft, tableTop, contentWidth, tableHeaderHeight, "F");
      doc.text("Course Structure", marginLeft + contentWidth / 2, tableTop + 16, {
        align: "center",
      });

      y = tableTop + tableHeaderHeight;

      // Column headers
      const columnHeaderHeight = 20;
      const colWeekWidth = 60;
      const colTopicWidth = 260;
      const colDetailsWidth = Math.max(120, contentWidth - colWeekWidth - colTopicWidth);

      doc.setFillColor(241, 245, 249); // slate-100
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.rect(marginLeft, y, contentWidth, columnHeaderHeight, "F");
      doc.text("Week", marginLeft + 6, y + 13);
      doc.text("Lesson topic", marginLeft + colWeekWidth + 6, y + 13);
      doc.text("Details / notes", marginLeft + colWeekWidth + colTopicWidth + 6, y + 13);

      y += columnHeaderHeight;

      // Flatten week plan into rows
      const rows: { week: number; topic: string }[] = [];
      weekPlan.forEach((week) => {
        if (week.topics.length === 0) {
          rows.push({ week: week.week, topic: "(no topics assigned yet)" });
        } else {
          week.topics.forEach((topic) => {
            rows.push({ week: week.week, topic });
          });
        }
      });

      const rowHeight = 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const drawTableHeaderOnNewPage = () => {
        const headerTop = marginTop;
        doc.setFillColor(15, 23, 42);
        doc.setTextColor(248, 250, 252);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.rect(marginLeft, headerTop, contentWidth, tableHeaderHeight, "F");
        doc.text("Course Structure (cont.)", marginLeft + contentWidth / 2, headerTop + 16, {
          align: "center",
        });

        const headerY = headerTop + tableHeaderHeight;
        doc.setFillColor(241, 245, 249);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.rect(marginLeft, headerY, contentWidth, columnHeaderHeight, "F");
        doc.text("Week", marginLeft + 6, headerY + 13);
        doc.text("Lesson topic", marginLeft + colWeekWidth + 6, headerY + 13);
        doc.text("Details / notes", marginLeft + colWeekWidth + colTopicWidth + 6, headerY + 13);

        return headerY + columnHeaderHeight;
      };

      rows.forEach((row) => {
        if (y > pageHeight - marginTop - rowHeight) {
          doc.addPage();
          y = drawTableHeaderOnNewPage();
        }

        // Cell borders
        doc.setDrawColor(148, 163, 184); // slate-400
        doc.rect(marginLeft, y, colWeekWidth, rowHeight);
        doc.rect(marginLeft + colWeekWidth, y, colTopicWidth, rowHeight);
        doc.rect(
          marginLeft + colWeekWidth + colTopicWidth,
          y,
          colDetailsWidth,
          rowHeight,
        );

        // Text
        doc.setTextColor(15, 23, 42);
        doc.text(String(row.week), marginLeft + 6, y + 13);
        doc.text(row.topic, marginLeft + colWeekWidth + 6, y + 13, {
          maxWidth: colTopicWidth - 12,
        });

        y += rowHeight;
      });

      doc.save("ai-cademy-syllabus.pdf");
    };

    // Load SVG logo, rasterize it to PNG via canvas, then build the PDF
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
          const dataUrl = canvas.toDataURL("image/png");
          buildDocument(dataUrl);
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

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
      {/* Input side */}
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
                    {manualTopics.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-200">
                        {manualTopics.map((t, idx) => (
                          <li
                            key={`${t}-${idx}`}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-0.5"
                          >
                            <span className="max-w-[10rem] truncate" title={t}>
                              {t}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveManualTopic(idx)}
                              className="text-[10px] text-slate-500 hover:text-red-300"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Topics</span>
                  <span className="text-slate-500">Add the main ideas you want to cover.</span>
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
                {manualTopics.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-200">
                    {manualTopics.map((t, idx) => (
                      <li
                        key={`${t}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-0.5"
                      >
                        <span className="max-w-[10rem] truncate" title={t}>
                          {t}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveManualTopic(idx)}
                          className="text-[10px] text-slate-500 hover:text-red-300"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
            disabled={topics.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_35px_rgba(16,185,129,0.5)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
          >
            <span>Generate syllabus layout</span>
          </button>
        </div>
      </form>

      {/* Result side */}
      <div
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span className="text-base">📚</span>
          Week-by-week syllabus
        </h2>

        {!hasGenerated ? (
          <p className="text-xs text-slate-400">
            Choose topics and number of weeks, then generate a syllabus layout. The
            ordered weeks and topics will appear here and can be downloaded as a
            text file.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 max-h-[360px] overflow-y-auto pr-1">
              {weekPlan.map((week) => (
                <div
                  key={week.week}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100">
                      Week {week.week}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {week.topics.length} topics
                    </span>
                  </div>
                  {week.topics.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No topics assigned.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-[11px] text-slate-200">
                      {week.topics.map((t, idx) => (
                        <li key={`${week.week}-${idx}`} className="flex items-start gap-2">
                          <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-400">
              <span>
                Download a PDF syllabus with instructor details for your course
                planning documents.
              </span>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
              >
                <span>Download PDF</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
