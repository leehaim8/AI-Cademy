import { useMemo, useState, type ChangeEvent, type SyntheticEvent } from "react";
import jsPDF from "jspdf";
import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  generateHomework,
  generateHomeworkWithFile,
  type HomeworkDifficulty,
  type HomeworkGenerationResponse,
  type HomeworkQuestion,
} from "../../lib/api";
import { enableAgentForCourse, getAgentAvailability } from "../../lib/courseStore";
import { createRun, createSession } from "../../lib/sessionStore";
import type { SessionRun } from "../../types/course";

type InputMode = "text" | "file";

type HomeworkAgentViewProps = {
  selectedRun?: SessionRun | null;
  onClearSelectedRun?: () => void;
  clearSelectionVersion?: number;
};

type SavedHomeworkInput = {
  chapter_text?: string;
  chapter_title?: string;
  input_mode?: InputMode;
  mcq_question_count?: number;
  open_question_count?: number;
  base_difficulty?: HomeworkDifficulty;
  points_per_question?: number;
  mcq_option_count?: number;
  mcq_correct_count?: number;
};

type SavedHomeworkOutput = {
  questions?: HomeworkQuestion[];
};

export default function HomeworkAgentView({
  selectedRun = null,
  onClearSelectedRun,
  clearSelectionVersion = 0,
}: HomeworkAgentViewProps) {
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: {
      fromBookletAgent?: boolean;
      chapterText?: string;
      chapterTitle?: string;
    };
  };
  const { courseId = "", agentKey = "" } = useParams();

  const initialImportedChapter = useMemo(
    () =>
      location.state?.fromBookletAgent && location.state.chapterText?.trim()
        ? {
            text: location.state.chapterText.trim(),
            title: location.state.chapterTitle?.trim() || "Imported chapter",
          }
        : null,
    [
      location.state?.chapterText,
      location.state?.chapterTitle,
      location.state?.fromBookletAgent,
    ],
  );

  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [chapterSource, setChapterSource] = useState<string>(
    initialImportedChapter?.text ?? "",
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");
  const [mcqCount, setMcqCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [mcqOptionCount, setMcqOptionCount] = useState(0);
  const [mcqCorrectCount, setMcqCorrectCount] = useState(1);
  const [baseDifficulty, setBaseDifficulty] =
    useState<HomeworkDifficulty>("medium");
  const [basePoints, setBasePoints] = useState(10);
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const importedChapter = initialImportedChapter;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const isSupported = /\.(pdf|docx|txt|md|csv|json|html|htm)$/i.test(file.name);
    setUploadedFileName(file.name);
    setUploadedFile(file);

    if (!isSupported) {
      setUploadError(
        "Supported chapter files: PDF, DOCX, TXT, MD, CSV, JSON, and HTML.",
      );
      setChapterSource("");
      return;
    }

    const isTextLike = /\.(txt|md|csv|json|html|htm)$/i.test(file.name);
    if (!isTextLike) {
      setUploadError(null);
      setChapterSource("");
      return;
    }

    try {
      const text = await file.text();
      setChapterSource(text);
      setUploadError(null);
    } catch {
      setUploadError("Could not read the selected file.");
      setChapterSource("");
    }
  };

  const totalPoints = useMemo(
    () => questions.reduce((sum, question) => sum + question.points, 0),
    [questions],
  );

  const evaluationPayload = useMemo(() => {
    const assignment = questions
      .map((question, index) => {
        const header = `${index + 1}. ${question.type === "mcq" ? "Multiple-choice" : "Open-ended"} (${question.points} pts)`;
        const options =
          question.options.length > 0
            ? `\n${question.options
                .map((option) => `${option.label}. ${option.text}`)
                .join("\n")}`
            : "";
        return `${header}\n${question.prompt}${options}`;
      })
      .join("\n\n");

    const questionsText = questions
      .map((question, index) => `Question ${index + 1}: ${question.prompt}`)
      .join("\n");

    const criteria = questions
      .map((question, index) => {
        const items = question.grading_criteria
          .map((criterion) => `- ${criterion}`)
          .join("\n");
        return `Question ${index + 1}\n${items}`;
      })
      .join("\n\n");

    return { assignment, questionsText, criteria };
  }, [questions]);

  const handleDownloadPdf = () => {
    if (questions.length === 0) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 44;
    const topMargin = 46;
    const bottomMargin = 42;
    const lineHeight = 16;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginX * 2;
    let y = topMargin;

    const drawPageFrame = (pageLabel?: string) => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 22, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(
        marginX - 16,
        topMargin - 16,
        contentWidth + 32,
        pageHeight - topMargin - bottomMargin + 8,
        16,
        16,
      );

      if (pageLabel) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(pageLabel, pageWidth - marginX, pageHeight - 18, {
          align: "right",
        });
      }
    };

    const ensureSpace = (neededHeight: number) => {
      if (y + neededHeight <= pageHeight - bottomMargin) return;
      doc.addPage();
      y = topMargin;
      drawPageFrame();
    };

    const addWrappedText = (
      text: string,
      x: number,
      width: number,
      options?: {
        bold?: boolean;
        color?: [number, number, number];
        fontSize?: number;
        extraSpacing?: number;
      },
    ) => {
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      doc.setFontSize(options?.fontSize ?? 11);
      if (options?.color) {
        doc.setTextColor(...options.color);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      const lines = doc.splitTextToSize(text, width);
      const height = lines.length * lineHeight;
      ensureSpace(height + 4);
      doc.text(lines, x, y);
      y += height + (options?.extraSpacing ?? 4);
    };

    const addSectionLabel = (label: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(label.toUpperCase(), marginX, y);
      y += 14;
    };

    const addBulletList = (items: string[]) => {
      items.forEach((item) => {
        ensureSpace(18);
        doc.setFillColor(56, 189, 248);
        doc.circle(marginX + 4, y - 3, 2, "F");
        addWrappedText(item, marginX + 14, contentWidth - 14, {
          fontSize: 11,
          extraSpacing: 3,
        });
      });
    };

    drawPageFrame();

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(marginX, y, contentWidth, 76, 18, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(248, 250, 252);
    doc.text("AI CADEMY Homework Set", marginX + 18, y + 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(191, 219, 254);
    doc.text(
      `Source chapter: ${importedChapter?.title || "Pasted / uploaded chapter"}`,
      marginX + 18,
      y + 50,
    );
    doc.text(
      `Generated on ${new Date().toLocaleDateString()}`,
      marginX + 18,
      y + 66,
    );
    y += 96;

    const summaryWidth = (contentWidth - 24) / 3;
    const summaryCards = [
      { label: "Questions", value: String(questions.length) },
      { label: "Points", value: String(totalPoints) },
      {
        label: "Difficulty",
        value:
          baseDifficulty.charAt(0).toUpperCase() + baseDifficulty.slice(1),
      },
    ];

    summaryCards.forEach((card, index) => {
      const cardX = marginX + index * (summaryWidth + 12);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(cardX, y, summaryWidth, 48, 12, 12, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(card.label, cardX + 14, y + 17);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(card.value, cardX + 14, y + 35);
    });
    y += 68;

    questions.forEach((question, index) => {
      ensureSpace(180);
      const headerY = y;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, headerY, contentWidth, 28, 10, 10, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${index + 1}. ${question.type === "mcq" ? "Multiple-choice" : "Open-ended"}`,
        marginX + 12,
        headerY + 18,
      );
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(
        `${question.difficulty.toUpperCase()}  •  ${question.points} pts`,
        marginX + contentWidth - 12,
        headerY + 18,
        { align: "right" },
      );
      y += 42;

      addSectionLabel("Question");
      addWrappedText(question.prompt, marginX, contentWidth, {
        bold: true,
        fontSize: 13,
        extraSpacing: 10,
      });

      if (question.options.length > 0) {
        addSectionLabel("Answer choices");
        question.options.forEach((option) => {
          const optionHeight = 34;
          ensureSpace(optionHeight + 4);
          doc.setFillColor(option.is_correct ? 236 : 248, option.is_correct ? 253 : 250, option.is_correct ? 245 : 252);
          doc.setDrawColor(option.is_correct ? 16 : 203, option.is_correct ? 185 : 213, option.is_correct ? 129 : 225);
          doc.roundedRect(marginX, y - 2, contentWidth, optionHeight, 10, 10, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(`${option.label}.`, marginX + 12, y + 17);
          doc.setFont("helvetica", "normal");
          const optionLines = doc.splitTextToSize(option.text, contentWidth - 48);
          doc.text(optionLines, marginX + 34, y + 17);
          if (option.is_correct) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(5, 150, 105);
            doc.text("Correct", marginX + contentWidth - 12, y + 17, {
              align: "right",
            });
          }
          y += optionHeight + 8;
        });
        addWrappedText(
          `Correct answers required: ${question.correct_answers_count ?? 1}`,
          marginX,
          contentWidth,
          { color: [71, 85, 105], fontSize: 10, extraSpacing: 10 },
        );
      }

      const answerLines = doc.splitTextToSize(question.student_answer, contentWidth - 24);
      const answerHeight = Math.max(56, answerLines.length * lineHeight + 28);
      ensureSpace(answerHeight + 14);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, y - 2, contentWidth, answerHeight, 12, 12, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("ANSWER", marginX + 14, y + 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(answerLines, marginX + 14, y + 30);
      y += answerHeight + 12;

      const criteriaHeight = Math.max(58, question.grading_criteria.length * 18 + 28);
      ensureSpace(criteriaHeight + 18);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, y - 2, contentWidth, criteriaHeight, 12, 12, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("GRADING CRITERIA", marginX + 14, y + 12);
      y += 30;
      addBulletList(question.grading_criteria);
      y += 10;

      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y, marginX + contentWidth, y);
      y += 18;
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - marginX, pageHeight - 18, {
        align: "right",
      });
    }

    const safeName = (importedChapter?.title || "homework-set")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    doc.save(`${safeName || "homework-set"}-homework.pdf`);
  };

  const handleGenerate = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedChapter = chapterSource.trim();
    const hasUpload = inputMode === "file" && uploadedFile;
    if (!trimmedChapter && !hasUpload) {
      setGenerationError("Paste or upload a chapter before generating homework.");
      return;
    }

    if (mcqCount + openCount < 1) {
      setGenerationError("Choose at least one homework question.");
      return;
    }

    if (mcqCount > 0) {
      if (mcqOptionCount < 2) {
        setGenerationError(
          "Multiple-choice questions need at least 2 answer options.",
        );
        return;
      }
      if (mcqCorrectCount < 1) {
        setGenerationError(
          "Multiple-choice questions need at least 1 correct answer.",
        );
        return;
      }
      if (mcqCorrectCount > mcqOptionCount) {
        setGenerationError(
          "The number of correct multiple-choice answers cannot be larger than the number of options.",
        );
        return;
      }
    }

    setGenerationError(null);
    setIsGenerating(true);

    try {
      const response: HomeworkGenerationResponse =
        inputMode === "file" && uploadedFile
          ? await generateHomeworkWithFile({
              file: uploadedFile,
              chapter_title: importedChapter?.title || uploadedFile.name,
              mcq_question_count: mcqCount,
              open_question_count: openCount,
              base_difficulty: baseDifficulty,
              points_per_question: basePoints,
              mcq_option_count: mcqOptionCount,
              mcq_correct_count: mcqCorrectCount,
            })
          : await generateHomework({
              chapter_text: trimmedChapter,
              chapter_title: importedChapter?.title,
              mcq_question_count: mcqCount,
              open_question_count: openCount,
              base_difficulty: baseDifficulty,
              points_per_question: basePoints,
              mcq_option_count: mcqOptionCount,
              mcq_correct_count: mcqCorrectCount,
            });

      setQuestions(response.questions);
      setHasGenerated(true);
      setSaveMessage(null);
      setSaveState("idle");
    } catch (error) {
      setQuestions([]);
      setHasGenerated(false);
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Homework generation failed. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveOutput = async () => {
    if (!courseId || !agentKey) {
      setSaveState("error");
      setSaveMessage("Course context is missing, so the homework could not be saved.");
      return;
    }

    if (questions.length === 0) {
      setSaveState("error");
      setSaveMessage("Generate homework before saving it.");
      return;
    }

    const timestamp = new Date();
    const timestampLabel = timestamp.toLocaleString();
    const fileName =
      inputMode === "file" ? uploadedFileName || "Unknown file" : "None";
    const sessionTitle = `${
      importedChapter?.title?.trim() || "Homework output"
    } · ${timestampLabel} · ${fileName}`;

    try {
      const session = await createSession(
        courseId,
        agentKey,
        sessionTitle,
        [
          "Homework output",
          `Timestamp: ${timestampLabel}`,
          `File: ${fileName}`,
        ].join("\n"),
      );

      await createRun(
      session.id,
      {
        chapter_text: chapterSource,
        chapter_title: importedChapter?.title || uploadedFileName || "",
        input_mode: inputMode,
        mcq_question_count: mcqCount,
        open_question_count: openCount,
        base_difficulty: baseDifficulty,
        points_per_question: basePoints,
        mcq_option_count: mcqOptionCount,
        mcq_correct_count: mcqCorrectCount,
        timestamp: timestampLabel,
        uploaded_file: inputMode === "file" ? uploadedFileName || "" : "",
      },
      {
        questions,
      },
      "success",
      );

      setSaveState("success");
      setSaveMessage("Homework output saved to session history.");
      onClearSelectedRun?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save homework output.";
      setSaveState("error");
      setSaveMessage(message);
    }
  };

  const handleSendToEvaluation = () => {
    if (questions.length === 0) {
      return;
    }

    if (courseId) {
      const availability = getAgentAvailability(courseId);
      if (!availability.evaluation) {
        const shouldEnable = window.confirm(
          "Homework Checking Agent is not added to this course yet. Do you want to add it now?",
        );
        if (!shouldEnable) {
          return;
        }
        enableAgentForCourse(courseId, "evaluation");
      }
    }

    navigate(
      courseId ? `/courses/${courseId}/agents/evaluation` : "/agent/evaluation",
      {
        state: {
          fromHomeworkAgent: true,
          assignment: evaluationPayload.assignment,
          questionsText: evaluationPayload.questionsText,
          criteria: evaluationPayload.criteria,
        },
      },
    );
  };

  useEffect(() => {
    if (!selectedRun) {
      return;
    }

    const inputData =
      selectedRun.input_data && typeof selectedRun.input_data === "object"
        ? (selectedRun.input_data as SavedHomeworkInput)
        : null;
    const outputData =
      selectedRun.output_data && typeof selectedRun.output_data === "object"
        ? (selectedRun.output_data as SavedHomeworkOutput)
        : null;

    if (typeof inputData?.chapter_text === "string") {
      setChapterSource(inputData.chapter_text);
    }
    if (inputData?.input_mode === "text" || inputData?.input_mode === "file") {
      setInputMode(inputData.input_mode);
    }
    if (typeof inputData?.mcq_question_count === "number") {
      setMcqCount(inputData.mcq_question_count);
    }
    if (typeof inputData?.open_question_count === "number") {
      setOpenCount(inputData.open_question_count);
    }
    if (
      inputData?.base_difficulty === "easy" ||
      inputData?.base_difficulty === "medium" ||
      inputData?.base_difficulty === "difficult"
    ) {
      setBaseDifficulty(inputData.base_difficulty);
    }
    if (typeof inputData?.points_per_question === "number") {
      setBasePoints(inputData.points_per_question);
    }
    if (typeof inputData?.mcq_option_count === "number") {
      setMcqOptionCount(inputData.mcq_option_count);
    }
    if (typeof inputData?.mcq_correct_count === "number") {
      setMcqCorrectCount(inputData.mcq_correct_count);
    }

    setUploadedFile(null);
    setUploadedFileName(null);
    setUploadError(null);
    setGenerationError(null);
    setSaveMessage(null);
    setSaveState("idle");

    if (Array.isArray(outputData?.questions)) {
      setQuestions(outputData.questions);
      setHasGenerated(outputData.questions.length > 0);
    }
  }, [selectedRun]);

  useEffect(() => {
    setInputMode("text");
    setChapterSource(initialImportedChapter?.text ?? "");
    setUploadedFile(null);
    setUploadedFileName(null);
    setUploadError(null);
    setGenerationError(null);
    setSaveMessage(null);
    setSaveState("idle");
    setMcqCount(0);
    setOpenCount(0);
    setMcqOptionCount(0);
    setMcqCorrectCount(1);
    setBaseDifficulty("medium");
    setBasePoints(10);
    setQuestions([]);
    setHasGenerated(false);
  }, [clearSelectionVersion, initialImportedChapter]);

  return (
    <div className="grid items-stretch gap-6 md:h-[max(80rem,calc(100vh-2rem))] md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
      <form
        onSubmit={handleGenerate}
        className="h-full overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl"
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Homework generator
            </h2>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-200">
              Source chapter / booklet
            </p>
            <div className="mb-2 inline-flex rounded-full bg-slate-900/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setInputMode("text");
                  setUploadError(null);
                }}
                className={`rounded-full px-3 py-1 transition-colors ${
                  inputMode === "text"
                    ? "bg-emerald-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Paste text
              </button>
              <button
                type="button"
                onClick={() => setInputMode("file")}
                className={`rounded-full px-3 py-1 transition-colors ${
                  inputMode === "file"
                    ? "bg-emerald-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Upload file
              </button>
            </div>

            {importedChapter ? (
              <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                Imported from Course Booklet Generator: {importedChapter.title}
              </div>
            ) : null}

            {inputMode === "text" ? (
              <textarea
                value={chapterSource}
                onChange={(event) => setChapterSource(event.target.value)}
                placeholder="Paste a chapter or section from the course booklet here."
                className="min-h-[140px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              />
            ) : (
              <div className="space-y-2">
                <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 text-center text-sm text-slate-300 transition-colors hover:border-emerald-500/80 hover:bg-slate-900/70">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    File
                  </span>
                  <span className="font-medium">
                    {uploadedFileName || "Drop a chapter file here or click to browse"}
                  </span>
                  <span className="text-xs text-slate-400">
                    Supported: PDF, DOCX, TXT, MD, CSV, JSON, HTML
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {uploadError ? (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {uploadError}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {generationError ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {generationError}
            </div>
          ) : null}

          <div className="grid flex-1 gap-3">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
              <label className="block text-sm font-semibold text-slate-100">
                Multiple-choice questions
              </label>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Set how many closed-ended questions to generate, how many answer
                choices each question should have, and how many answers are correct
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="flex h-full flex-col rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Question count
                  </label>
                  <p className="mt-1 min-h-[2.5rem] text-[10px] text-slate-500">
                    0-20 questions
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={mcqCount}
                    onChange={(event) => setMcqCount(Number(event.target.value) || 0)}
                    className="mt-auto w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                  />
                </div>
                <div className="flex h-full flex-col rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Answers per question
                  </label>
                  <p className="mt-1 min-h-[2.5rem] text-[10px] text-slate-500">
                    0-8 answer choices
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={mcqOptionCount}
                    onChange={(event) =>
                      setMcqOptionCount(Math.max(0, Number(event.target.value) || 0))
                    }
                    className="mt-auto w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                  />
                </div>
                <div className="flex h-full flex-col rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Correct answers
                  </label>
                  <p className="mt-1 min-h-[2.5rem] text-[10px] text-slate-500">
                    Allow one or more
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, mcqOptionCount)}
                    value={mcqCorrectCount}
                    onChange={(event) =>
                      setMcqCorrectCount(
                        Math.min(
                          Math.max(1, mcqOptionCount),
                          Math.max(1, Number(event.target.value) || 1),
                        ),
                      )
                    }
                    className="mt-auto w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/60 bg-slate-950/25 p-3.5">
              <label className="block text-sm font-semibold text-slate-100">
                Open questions
              </label>
              <p className="mt-1 text-[11px] text-slate-500">Choose between 0 and 20</p>
              <input
                type="number"
                min={0}
                max={20}
                value={openCount}
                onChange={(event) => setOpenCount(Number(event.target.value) || 0)}
                className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/75 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              />
            </div>

            <div className="rounded-xl border border-slate-800/60 bg-slate-950/25 p-3.5">
              <label className="block text-sm font-semibold text-slate-100">
                Difficulty
              </label>
              <p className="mt-1 text-[11px] text-slate-500">
                The generator may still rate each question individually
              </p>
              <select
                value={baseDifficulty}
                onChange={(event) =>
                  setBaseDifficulty(event.target.value as HomeworkDifficulty)
                }
                className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/75 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="difficult">Difficult</option>
              </select>
            </div>

            <div className="rounded-xl border border-slate-800/60 bg-slate-950/25 p-3.5">
              <label className="block text-sm font-semibold text-slate-100">
                Points per question
              </label>
              <p className="mt-1 text-[11px] text-slate-500">Fixed score value for every question</p>
              <input
                type="number"
                min={1}
                max={100}
                value={basePoints}
                onChange={(event) => setBasePoints(Number(event.target.value) || 1)}
                className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/75 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
              />
            </div>

            <div className="rounded-xl border border-slate-800/60 bg-slate-950/25 p-3.5">
              <p className="text-sm font-semibold text-slate-100">Summary</p>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Total questions</span>
                  <span className="font-semibold text-slate-100">
                    {mcqCount + openCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Points</span>
                  <span className="font-semibold text-emerald-200">
                    {(mcqCount + openCount) * basePoints}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex md:justify-end">
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_35px_rgba(16,185,129,0.45)] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "Generating questions..." : "Generate homework"}
            </button>
          </div>
        </div>
      </form>

      <div className="flex h-full min-h-[260px] flex-col gap-3 overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Generated homework
            </h3>
          </div>
          {hasGenerated ? (
            <div className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              Total points: {totalPoints}
            </div>
          ) : null}
        </div>

        {hasGenerated ? (
          <div className="flex flex-wrap justify-start gap-3">
            <button
              type="button"
              onClick={handleSendToEvaluation}
              className="inline-flex items-center justify-center rounded-lg border border-violet-500/60 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
            >
              Send to Homework Checking Agent
            </button>
            <button
              type="button"
              onClick={handleSaveOutput}
              className="inline-flex items-center justify-center rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
            >
              Save output
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Download PDF
            </button>
          </div>
        ) : null}

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

        {!hasGenerated ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 px-4 py-6 text-center text-[11px] text-slate-400">
            <p className="mb-1 font-medium text-slate-200">
              No homework generated yet
            </p>
            <p>
              Provide a chapter, choose the number and type of questions, and the
              generated homework will appear here
            </p>
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/35 p-3">
            <div className="homework-scroll h-full min-h-0 flex-1 space-y-3 overflow-y-scroll pr-2">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-3 text-xs text-slate-100 shadow-inner"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-200">
                        {index + 1}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-200">
                        <span>
                          {question.type === "mcq" ? "Multiple-choice" : "Open-ended"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-500" />
                        <span className="capitalize">{question.difficulty}</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-300">
                      {question.points} pts
                    </span>
                  </div>

                  <p className="whitespace-pre-line text-[12px] font-medium text-slate-100">
                    {question.prompt}
                  </p>

                  {question.options.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Answer choices
                      </p>
                      <ul className="grid gap-2 text-[11px] text-slate-200">
                        {question.options.map((option) => (
                          <li
                            key={option.label}
                            className={`flex min-h-[8.75rem] items-start gap-3 rounded-xl border px-4 py-3 ${
                              option.is_correct
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                                : "border-slate-800 bg-slate-950/50"
                            }`}
                          >
                            <span className="font-semibold">{option.label}.</span>
                            <span>{option.text}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-slate-400">
                        Correct answers required: {question.correct_answers_count}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Answer
                    </p>
                    <p className="mt-2 whitespace-pre-line text-[11px] text-slate-200">
                      {question.student_answer}
                    </p>
                  </div>

                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Grading criteria
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-slate-200">
                      {question.grading_criteria.map((criterion, criterionIndex) => (
                        <li key={criterionIndex} className="flex gap-2">
                          <span className="mt-[4px] h-1.5 w-1.5 rounded-full bg-cyan-400" />
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
