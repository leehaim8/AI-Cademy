import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import jsPDF from "jspdf";
import { useLocation, useParams } from "react-router-dom";

import {
  checkHomework,
  type HomeworkQuestion,
  type HomeworkCheckResponse,
} from "../../lib/api";
import { createRun, createSession } from "../../lib/sessionStore";
import type { SessionRun } from "../../types/course";
import AgentActionButton from "../../components/AgentActionButton";

type InputMode = "text" | "file";

type StructuredQuestionInput = {
  prompt: string;
  points: number;
  type: "mcq" | "open";
  grading_criteria: string[];
  options?: HomeworkQuestion["options"];
};

type ManualQuestionInput = {
  type: "mcq" | "open";
  prompt: string;
  points: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctLabel: "A" | "B" | "C" | "D" | "";
  criteriaText: string;
};

type EvaluationAgentViewProps = {
  selectedRun?: SessionRun | null;
  onClearSelectedRun?: () => void;
  clearSelectionVersion?: number;
};

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

function splitCriteria(text: string): string[] {
  return text
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createEmptyQuestion(type: ManualQuestionInput["type"] = "mcq"): ManualQuestionInput {
  return {
    type,
    prompt: "",
    points: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctLabel: "",
    criteriaText: "",
  };
}

function buildPdfSafeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SavedEvaluationInput = {
  assignment_text?: string;
  questions_text?: string;
  rubric_text?: string;
  student_answer_text?: string;
  structured_questions?: StructuredQuestionInput[];
};

type SavedEvaluationOutput = {
  review?: HomeworkCheckResponse | null;
};

export default function EvaluationAgentView({
  selectedRun,
  onClearSelectedRun,
  clearSelectionVersion,
}: EvaluationAgentViewProps) {
  const { courseId = "", agentKey = "" } = useParams();
  const location = useLocation() as {
    state?: {
      fromHomeworkAgent?: boolean;
      assignment?: string;
      questionsText?: string;
      criteria?: string;
      structuredQuestions?: StructuredQuestionInput[];
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
  const importedStructuredQuestions =
    importedFromHomework && Array.isArray(location.state?.structuredQuestions)
      ? location.state.structuredQuestions
      : [];
  const importedManualQuestions: ManualQuestionInput[] =
    importedStructuredQuestions.length > 0
      ? importedStructuredQuestions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          points: String(question.points),
          optionA: question.options?.[0]?.text ?? "",
          optionB: question.options?.[1]?.text ?? "",
          optionC: question.options?.[2]?.text ?? "",
          optionD: question.options?.[3]?.text ?? "",
          correctLabel:
            (question.options?.find((option) => option.is_correct)?.label as ManualQuestionInput["correctLabel"]) ?? "",
          criteriaText: question.grading_criteria.join("\n"),
        }))
      : [createEmptyQuestion("mcq")];

  const [assignment, setAssignment] = useState(importedAssignment);
  const [criteria, setCriteria] = useState(importedCriteria);
  const [questionsText, setQuestionsText] = useState(importedQuestionsText);
  const [manualQuestions, setManualQuestions] = useState<ManualQuestionInput[]>(importedManualQuestions);
  const [submission, setSubmission] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [review, setReview] = useState<HomeworkCheckResponse | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "success" | "error">("idle");
  const [assignmentInputMode, setAssignmentInputMode] = useState<InputMode>("text");
  const [criteriaInputMode, setCriteriaInputMode] = useState<InputMode>("text");
  const [assignmentUploadError, setAssignmentUploadError] = useState<string | null>(null);
  const [criteriaUploadError, setCriteriaUploadError] = useState<string | null>(null);
  const [submissionInputMode, setSubmissionInputMode] = useState<InputMode>("text");
  const [submissionUploadError, setSubmissionUploadError] = useState<string | null>(null);

  const handleFileChange = async (
    file: File | undefined,
    setContent: (content: string) => void,
    setError: (error: string | null) => void,
  ) => {
    if (!file) return;

    const isSupported = /\.(pdf|docx|txt|md|csv|json|html|htm)$/i.test(file.name);
    if (!isSupported) {
      setError("Supported file types: PDF, DOCX, TXT, MD, CSV, JSON, and HTML.");
      setContent("");
      return;
    }

    const isTextLike = /\.(txt|md|csv|json|html|htm)$/i.test(file.name);
    if (!isTextLike) {
      setError(null);
      setContent("");
      return;
    }

    try {
      const text = await file.text();
      setContent(text);
      setError(null);
    } catch {
      setError("Could not read the selected file.");
      setContent("");
    }
  };

  useEffect(() => {
    if (!selectedRun) {
      return;
    }

    const inputData =
      selectedRun.input_data && typeof selectedRun.input_data === "object"
        ? (selectedRun.input_data as SavedEvaluationInput)
        : null;
    const outputData =
      selectedRun.output_data && typeof selectedRun.output_data === "object"
        ? (selectedRun.output_data as SavedEvaluationOutput)
        : null;

    if (typeof inputData?.assignment_text === "string") {
      setAssignment(inputData.assignment_text);
    }
    if (typeof inputData?.questions_text === "string") {
      setQuestionsText(inputData.questions_text);
    }
    if (typeof inputData?.rubric_text === "string") {
      setCriteria(inputData.rubric_text);
    }
    if (typeof inputData?.student_answer_text === "string") {
      setSubmission(inputData.student_answer_text);
    }

    if (Array.isArray(inputData?.structured_questions)) {
      setManualQuestions(
        inputData.structured_questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          points: String(question.points),
          optionA: question.options?.[0]?.text ?? "",
          optionB: question.options?.[1]?.text ?? "",
          optionC: question.options?.[2]?.text ?? "",
          optionD: question.options?.[3]?.text ?? "",
          correctLabel:
            (question.options?.find((option) => option.is_correct)?.label as ManualQuestionInput["correctLabel"]) ?? "",
          criteriaText: question.grading_criteria.join("\n"),
        })),
      );
    }

    if (outputData?.review) {
      setReview(outputData.review);
      setHasSubmitted(true);
    }

    setSaveMessage(null);
    setSaveState("idle");
    setPdfMessage(null);
    setPdfState("idle");
  }, [selectedRun, clearSelectionVersion]);

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

    const structuredQuestions: StructuredQuestionInput[] = [];

    for (const question of manualQuestions) {
      const prompt = question.prompt.trim();
      const points = Number(question.points);

      if (!prompt || Number.isNaN(points) || points < 0) {
        continue;
      }

      if (question.type === "mcq") {
        structuredQuestions.push({
          prompt,
          points,
          type: "mcq",
          grading_criteria: [],
          options: [
            { label: "A", text: question.optionA.trim(), is_correct: question.correctLabel === "A" },
            { label: "B", text: question.optionB.trim(), is_correct: question.correctLabel === "B" },
            { label: "C", text: question.optionC.trim(), is_correct: question.correctLabel === "C" },
            { label: "D", text: question.optionD.trim(), is_correct: question.correctLabel === "D" },
          ],
        });
        continue;
      }

      structuredQuestions.push({
        prompt,
        points,
        type: "open",
        grading_criteria: splitCriteria(question.criteriaText),
        options: [],
      });
    }

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
        structured_questions: structuredQuestions,
      });
      setReview(result);
      setSaveMessage(null);
      setSaveState("idle");
      setPdfMessage(null);
      setPdfState("idle");
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
    setManualQuestions([createEmptyQuestion("mcq")]);
    setSubmission("");
    setHasSubmitted(false);
    setErrorMessage(null);
    setReview(null);
    setSaveMessage(null);
    setSaveState("idle");
    setPdfMessage(null);
    setPdfState("idle");
  };

  const handleDownloadPdf = () => {
    if (!review) {
      setPdfState("error");
      setPdfMessage("Run homework check before downloading the PDF.");
      return;
    }

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
      if (y + neededHeight <= pageHeight - bottomMargin) {
        return;
      }

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
        fontSize?: number;
        color?: [number, number, number];
        extraSpacing?: number;
      },
    ) => {
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      doc.setFontSize(options?.fontSize ?? 11);
      doc.setTextColor(...(options?.color ?? [15, 23, 42]));
      const lines = doc.splitTextToSize(text, width);
      ensureSpace(lines.length * lineHeight + 4);
      doc.text(lines, x, y);
      y += lines.length * lineHeight + (options?.extraSpacing ?? 6);
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

    const addTextPanel = (label: string, value: string, minHeight = 56) => {
      const labelHeight = 12;
      const textLines = doc.splitTextToSize(value, contentWidth - 24);
      const panelHeight = Math.max(minHeight, textLines.length * lineHeight + 30);

      ensureSpace(panelHeight + 14);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, y - 2, contentWidth, panelHeight, 12, 12, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(label.toUpperCase(), marginX + 14, y + labelHeight);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(textLines, marginX + 14, y + 28);
      y += panelHeight + 12;
    };

    drawPageFrame();

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(marginX, y, contentWidth, 76, 18, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(248, 250, 252);
    doc.text("AI CADEMY Homework Check", marginX + 18, y + 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(191, 219, 254);
    doc.text(`Generated on ${new Date().toLocaleString()}`, marginX + 18, y + 50);
    y += 96;

    const summaryWidth = (contentWidth - 24) / 3;
    const summaryCards = [
      {
        label: "Score",
        value: `${Math.round(review.total_score)}/100`,
      },
      {
        label: "Questions",
        value: String(Object.keys(review.per_question_scores).length),
      },
      {
        label: "Rubric items",
        value: String(review.per_requirement_results.length),
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

    addTextPanel("Assignment", assignment || "No assignment text provided.");
    addTextPanel("Rubric", criteria || "No rubric provided.");
    addTextPanel("Student submission", submission || "No student submission provided.");
    addTextPanel("Overall feedback", review.overall_feedback || "No overall feedback was generated.");

    addSectionLabel("Scores by question");
    Object.entries(review.per_question_scores).forEach(([questionId, score]) => {
      ensureSpace(26);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, y - 2, contentWidth, 24, 10, 10, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(questionId, marginX + 12, y + 14);
      doc.setTextColor(16, 185, 129);
      doc.text(`${Math.round(score)}/100`, marginX + contentWidth - 12, y + 14, {
        align: "right",
      });
      y += 34;
    });

    addSectionLabel("Detailed results");
    review.per_requirement_results.forEach((item) => {
      const resultStart = y;
      const feedbackLines = doc.splitTextToSize(item.feedback, contentWidth - 24);
      const matchedConceptLines = item.evidence.matched_concepts.length > 0 ? item.evidence.matched_concepts.length * 18 + 18 : 0;
      const missingConceptLines = item.evidence.missing_concepts.length > 0 ? item.evidence.missing_concepts.length * 18 + 18 : 0;
      const snippetLines = item.evidence.answer_snippet
        ? doc.splitTextToSize(item.evidence.answer_snippet, contentWidth - 24).length * lineHeight + 34
        : 0;
      const explanationLines = item.evidence.semantic_explanation
        ? doc.splitTextToSize(item.evidence.semantic_explanation, contentWidth - 24).length * lineHeight + 12
        : 0;
      const resultHeight = Math.max(
        126,
        58 + feedbackLines.length * lineHeight + matchedConceptLines + missingConceptLines + snippetLines + explanationLines,
      );

      ensureSpace(resultHeight + 16);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, y - 2, contentWidth, resultHeight, 12, 12, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(item.question_id, marginX + 14, y + 16);
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(item.status.replaceAll("_", " "), marginX + 14, y + 32);
      doc.setTextColor(16, 185, 129);
      doc.text(`${Math.round(item.score)}/100`, marginX + contentWidth - 14, y + 20, {
        align: "right",
      });

      y += 44;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(feedbackLines, marginX + 14, y);
      y += feedbackLines.length * lineHeight + 10;

      if (item.evidence.matched_concepts.length > 0) {
        addSectionLabel("Matched concepts");
        addBulletList(item.evidence.matched_concepts);
      }

      if (item.evidence.missing_concepts.length > 0) {
        addSectionLabel("Missing concepts");
        addBulletList(item.evidence.missing_concepts);
      }

      if (item.evidence.answer_snippet) {
        addTextPanel("Answer snippet", item.evidence.answer_snippet, 54);
      }

      if (item.evidence.semantic_explanation) {
        addTextPanel("Semantic explanation", item.evidence.semantic_explanation, 48);
      }

      if (y < resultStart + resultHeight - 10) {
        y = resultStart + resultHeight + 10;
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      drawPageFrame(`Page ${page} of ${totalPages}`);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - marginX, pageHeight - 18, {
        align: "right",
      });
    }

    const safeName = buildPdfSafeName(assignment || "homework-check");
    doc.save(`${safeName || "homework-check"}-report.pdf`);
    setPdfState("success");
    setPdfMessage("PDF downloaded.");
  };

  const handleSaveOutput = async () => {
    if (!courseId || !agentKey) {
      setSaveState("error");
      setSaveMessage("Course context is missing, so the homework check could not be saved.");
      return;
    }

    if (!review) {
      setSaveState("error");
      setSaveMessage("Run homework check before saving it.");
      return;
    }

    const timestamp = new Date();
    const timestampLabel = timestamp.toLocaleString();
    const sessionTitle = `Homework check · ${timestampLabel}`;

    try {
      const session = await createSession(
        courseId,
        agentKey,
        sessionTitle,
        [
          "Homework check output",
          `Timestamp: ${timestampLabel}`,
        ].join("\n"),
      );

      await createRun(
        session.id,
        {
          assignment_text: assignment.trim(),
          questions_text: (questionsText || assignment).trim(),
          rubric_text: criteria.trim(),
          student_answer_text: submission.trim(),
          structured_questions: manualQuestions
            .map((question) => {
              const prompt = question.prompt.trim();
              const points = Number(question.points);
              if (!prompt || Number.isNaN(points) || points < 0) {
                return null;
              }

              if (question.type === "mcq") {
                return {
                  prompt,
                  points,
                  type: "mcq" as const,
                  grading_criteria: [],
                  options: [
                    { label: "A", text: question.optionA.trim(), is_correct: question.correctLabel === "A" },
                    { label: "B", text: question.optionB.trim(), is_correct: question.correctLabel === "B" },
                    { label: "C", text: question.optionC.trim(), is_correct: question.correctLabel === "C" },
                    { label: "D", text: question.optionD.trim(), is_correct: question.correctLabel === "D" },
                  ],
                };
              }

              return {
                prompt,
                points,
                type: "open" as const,
                grading_criteria: splitCriteria(question.criteriaText),
                options: [],
              };
            })
            .filter(Boolean),
        },
        {
          review,
        },
        "success",
      );

      setSaveState("success");
      setSaveMessage("Homework check output saved to session history.");
      onClearSelectedRun?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save homework check output.";
      setSaveState("error");
      setSaveMessage(message);
    }
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
            <p className="mb-2 text-[11px] font-semibold text-slate-200">
              Assignment instructions & questions
            </p>
            <div className="mb-2 inline-flex rounded-full bg-slate-900/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAssignmentInputMode("text");
                  setAssignmentUploadError(null);
                }}
                className={`rounded-full px-3 py-1 transition-colors ${
                  assignmentInputMode === "text"
                    ? "bg-sky-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Paste text
              </button>
              <button
                type="button"
                onClick={() => setAssignmentInputMode("file")}
                className={`rounded-full px-3 py-1 transition-colors ${
                  assignmentInputMode === "file"
                    ? "bg-sky-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Upload file
              </button>
            </div>

            {assignmentInputMode === "text" ? (
              <textarea
                value={assignment}
                onChange={(event) => setAssignment(event.target.value)}
                placeholder="Paste the homework description and questions."
                className="min-h-[110px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
              />
            ) : (
              <div className="space-y-2">
                <label className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 text-center text-sm text-slate-300 transition-colors hover:border-sky-500/80 hover:bg-slate-900/70">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    שאלה פתוחה
                  </span>
                  <span className="font-medium">Drop a file here or click to browse</span>
                  <span className="text-xs text-slate-400">
                    Supported: PDF, DOCX, TXT, MD, CSV, JSON, HTML
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm"
                    onChange={(event) =>
                      handleFileChange(
                        event.target.files?.[0],
                        setAssignment,
                        setAssignmentUploadError,
                      )
                    }
                    className="hidden"
                  />
                </label>
                {assignmentUploadError ? (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {assignmentUploadError}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold text-slate-200">
              Grading criteria / rubric
            </p>
            <div className="mb-2 inline-flex rounded-full bg-slate-900/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCriteriaInputMode("text");
                  setCriteriaUploadError(null);
                }}
                className={`rounded-full px-3 py-1 transition-colors ${
                  criteriaInputMode === "text"
                    ? "bg-sky-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Paste text
              </button>
              <button
                type="button"
                onClick={() => setCriteriaInputMode("file")}
                className={`rounded-full px-3 py-1 transition-colors ${
                  criteriaInputMode === "file"
                    ? "bg-sky-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Upload file
              </button>
            </div>

            {criteriaInputMode === "text" ? (
              <textarea
                value={criteria}
                onChange={(event) => setCriteria(event.target.value)}
                placeholder="List the rubric or grading criteria."
                className="min-h-[100px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
              />
            ) : (
              <div className="space-y-2">
                <label className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 text-center text-sm text-slate-300 transition-colors hover:border-sky-500/80 hover:bg-slate-900/70">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    File
                  </span>
                  <span className="font-medium">Drop a file here or click to browse</span>
                  <span className="text-xs text-slate-400">
                    Supported: PDF, DOCX, TXT, MD, CSV, JSON, HTML
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm"
                    onChange={(event) =>
                      handleFileChange(
                        event.target.files?.[0],
                        setCriteria,
                        setCriteriaUploadError,
                      )
                    }
                    className="hidden"
                  />
                </label>
                {criteriaUploadError ? (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {criteriaUploadError}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-slate-200">Manual homework questions</p>
                <p className="text-[11px] text-slate-500">Define the questions yourself here, without using the Homework Generator</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setManualQuestions((current) => [...current, createEmptyQuestion("mcq")])}
                  className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/15"
                >
                  + Add MCQ
                </button>
                <button
                  type="button"
                  onClick={() => setManualQuestions((current) => [...current, createEmptyQuestion("open")])}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15"
                >
                  + Add open question 
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {manualQuestions.map((question, index) => (
                <div key={index} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                        Question {index + 1}
                      </span>
                      <select
                        value={question.type}
                        onChange={(event) => {
                          const nextType = event.target.value as ManualQuestionInput["type"];
                          setManualQuestions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    type: nextType,
                                    correctLabel: nextType === "mcq" ? item.correctLabel : "",
                                    criteriaText: nextType === "open" ? item.criteriaText : item.criteriaText,
                                  }
                                : item,
                            ),
                          );
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="mcq">Multiple choice</option>
                        <option value="open">Open ended</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/15"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-400">Question text</span>
                      <textarea
                        value={question.prompt}
                        onChange={(event) => {
                          const nextPrompt = event.target.value;
                          setManualQuestions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, prompt: nextPrompt } : item,
                            ),
                          );
                        }}
                        className="min-h-[88px] w-full resize-y rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-400">Points</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={question.points}
                        onChange={(event) => {
                          const nextPoints = event.target.value;
                          setManualQuestions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, points: nextPoints } : item,
                            ),
                          );
                        }}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                      />
                    </label>
                  </div>

                  {question.type === "mcq" ? (
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px]">
                      <input value={question.optionA} onChange={(event) => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, optionA: event.target.value } : item))} placeholder="Option A" className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70" />
                      <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                        <input type="radio" name={`mcq-correct-${index}`} value="A" checked={question.correctLabel === "A"} onChange={() => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctLabel: "A" } : item))} />
                        Correct A
                      </label>
                      <input value={question.optionB} onChange={(event) => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, optionB: event.target.value } : item))} placeholder="Option B" className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70" />
                      <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                        <input type="radio" name={`mcq-correct-${index}`} value="B" checked={question.correctLabel === "B"} onChange={() => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctLabel: "B" } : item))} />
                        Correct B
                      </label>
                      <input value={question.optionC} onChange={(event) => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, optionC: event.target.value } : item))} placeholder="Option C" className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70" />
                      <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                        <input type="radio" name={`mcq-correct-${index}`} value="C" checked={question.correctLabel === "C"} onChange={() => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctLabel: "C" } : item))} />
                        Correct C
                      </label>
                      <input value={question.optionD} onChange={(event) => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, optionD: event.target.value } : item))} placeholder="Option D" className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70" />
                      <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                        <input type="radio" name={`mcq-correct-${index}`} value="D" checked={question.correctLabel === "D"} onChange={() => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctLabel: "D" } : item))} />
                        Correct D
                      </label>
                    </div>
                  ) : (
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-400">Criteria, one per line</span>
                      <textarea
                        value={question.criteriaText}
                        onChange={(event) => setManualQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, criteriaText: event.target.value } : item))}
                        className="min-h-[120px] w-full resize-y rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Student submission</span>
              <span className="text-slate-500">The answer you want to evaluate</span>
            </div>

            <div className="mb-2 inline-flex rounded-full bg-slate-900/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSubmissionInputMode("text");
                  setSubmissionUploadError(null);
                }}
                className={`rounded-full px-3 py-1 transition-colors ${
                  submissionInputMode === "text"
                    ? "bg-sky-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Paste text
              </button>
              <button
                type="button"
                onClick={() => setSubmissionInputMode("file")}
                className={`rounded-full px-3 py-1 transition-colors ${
                  submissionInputMode === "file"
                    ? "bg-sky-500 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Upload file
              </button>
            </div>

            {submissionInputMode === "text" ? (
              <textarea
                value={submission}
                onChange={(event) => setSubmission(event.target.value)}
                placeholder="Paste the student's answer, separated by Question 1 / Question 2 when possible."
                className="min-h-[150px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
              />
            ) : (
              <div className="space-y-2">
                <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 text-center text-sm text-slate-300 transition-colors hover:border-sky-500/80 hover:bg-slate-900/70">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    File
                  </span>
                  <span className="font-medium">Drop a file here or click to browse</span>
                  <span className="text-xs text-slate-400">Supported: PDF, DOCX, TXT, MD, CSV, JSON, HTML</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm"
                    onChange={(event) => handleFileChange(event.target.files?.[0], setSubmission, setSubmissionUploadError)}
                    className="hidden"
                  />
                </label>
                {submissionUploadError ? (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {submissionUploadError}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>Student answer length</span>
          <span>{wordCount} words</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <AgentActionButton onClick={clearAll} variant="rose">
            Clear all fields
          </AgentActionButton>
          <AgentActionButton
            type="submit"
            variant="emerald"
            disabled={!assignment.trim() || !criteria.trim() || !submission.trim() || isChecking}
          >
            {isChecking ? "Checking..." : "Run homework check"}
          </AgentActionButton>
        </div>
      </form>

      <div
        className="flex min-h-[260px] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl"
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
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <AgentActionButton onClick={handleSaveOutput} variant="sky">
                Save output
              </AgentActionButton>
              <AgentActionButton onClick={handleDownloadPdf} variant="violet">
                Download PDF
              </AgentActionButton>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
              <div className="h-full min-h-0 overflow-y-auto p-3 pr-2">
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

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-slate-200">
                    Overall feedback
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    {review.overall_feedback}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
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

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
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

                <div className="mt-4 space-y-3">
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

                {saveMessage ? (
                  <div
                    className={
                      "mt-4 rounded-xl border px-3 py-2 text-xs " +
                      (saveState === "success"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-200")
                    }
                  >
                    {saveMessage}
                  </div>
                ) : null}

                {pdfMessage ? (
                  <div
                    className={
                      "mt-3 rounded-xl border px-3 py-2 text-xs " +
                      (pdfState === "success"
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-200")
                    }
                  >
                    {pdfMessage}
                  </div>
                ) : null}
              </div>
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
