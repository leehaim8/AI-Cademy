import { useMemo, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";

const TOPIC_STOPWORDS = [
  "the",
  "and",
  "of",
  "to",
  "in",
  "a",
  "for",
  "is",
  "on",
  "with",
  "that",
  "this",
  "an",
  "as",
  "by",
  "from",
];

function getMockTopics(raw: string): string[] {
  if (!raw.trim()) return [];

  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !TOPIC_STOPWORDS.includes(w));

  const counts = new Map<string, number>();
  cleaned.forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

type UploadedFile = {
  name: string;
  content: string | null; // null = ׳¡׳•׳’ ׳§׳•׳‘׳¥ ׳©׳׳ ׳׳₪׳•׳¢׳ ׳— ׳‘׳“׳׳• (׳׳׳©׳ PDF)
};

type ReviewTopic = {
  id: string;
  title: string;
  approved: boolean;
  isEditing: boolean;
  draft: string;
};

const DEFAULT_REVIEW_TOPICS = [
  "Learning objectives",
  "Assessment criteria",
  "Key terminology",
  "Worked examples",
  "Assignments flow",
  "Course milestones",
];

export default function TopicAgentView() {
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [view, setView] = useState<"suggested" | "review">("suggested");
  const [reviewTopics, setReviewTopics] = useState<ReviewTopic[]>(
    DEFAULT_REVIEW_TOPICS.map((topic) => ({
      id: crypto.randomUUID(),
      title: topic,
      approved: true,
      isEditing: false,
      draft: topic,
    })),
  );

  const topics = useMemo(() => getMockTopics(text), [text]);

  const fileLabel = useMemo(() => {
    if (uploadedFiles.length === 0) return null;
    if (uploadedFiles.length === 1) return uploadedFiles[0].name;
    return `${uploadedFiles.length} files selected`;
  }, [uploadedFiles]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    const newItems = await Promise.all(
      fileArray.map(
        (file) =>
          new Promise<UploadedFile>((resolve) => {
            const isTextLike = /\.txt$|\.md$|\.csv$|\.json$/i.test(file.name);

            if (!isTextLike) {
              resolve({ name: file.name, content: null });
              return;
            }

            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                name: file.name,
                content: typeof reader.result === "string" ? reader.result : "",
              });
            };
            reader.readAsText(file);
          }),
      ),
    );

    setUploadedFiles((prev) => {
      const merged = [...prev, ...newItems];
      const combinedText = merged
        .map((f) => f.content ?? "")
        .filter(Boolean)
        .join("\n\n");
      setText(combinedText);
      return merged;
    });
  };

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasSubmitted(true);
    setIsAnalyzing(true);

    setTimeout(() => {
      setIsAnalyzing(false);
    }, 400);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-sm font-semibold text-slate-100">Input material</h2>
          <div className="inline-flex rounded-full bg-slate-800/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setInputMode("text")}
              className={`px-3 py-1 rounded-full transition-colors ${
                inputMode === "text"
                  ? "bg-sky-500 text-slate-50"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Paste text
            </button>
            <button
              type="button"
              onClick={() => setInputMode("file")}
              className={`px-3 py-1 rounded-full transition-colors ${
                inputMode === "file"
                  ? "bg-sky-500 text-slate-50"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Upload file
            </button>
          </div>
        </div>

        {inputMode === "text" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste 1ג€“3 paragraphs of course material, an assignment description, or syllabus section..."
            className="min-h-[220px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
          />
        ) : (
          <>
            <label
              className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 text-center text-sm text-slate-300 hover:border-sky-500/80 hover:bg-slate-900/70 transition-colors"
            >
              <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                File
              </span>
              <span className="font-medium">
                {fileLabel || "Drop document files here or click to browse"}
              </span>
              <span className="text-xs text-slate-400">
                Supports common document formats (PDF, Word, text and more).
              </span>
              <input
                type="file"
                multiple
                accept=".txt,.md,.pdf,.doc,.docx,.rtf,.odt,.ppt,.pptx,.csv,.json,.html,.htm"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {uploadedFiles.length > 0 && (
              <ul className="mt-3 w-full text-left text-xs text-slate-300 space-y-1">
                {uploadedFiles.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-2 rounded-md bg-slate-950/60 px-3 py-1 border border-slate-800/80"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFiles((prev) => {
                          const next = prev.filter((f) => f.name !== file.name);
                          const combined = next
                            .map((f) => f.content ?? "")
                            .filter(Boolean)
                            .join("\n\n");
                          setText(combined);
                          if (next.length === 0) {
                            setHasSubmitted(false);
                          }
                          return next;
                        });
                      }}
                      className="ml-2 rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
          <span>
            We run a simple in-browser keyword scan ג€“ this is just a
            frontג€‘end demo.
          </span>
          <span>{text.length} chars</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setText("");
              setUploadedFiles([]);
              setHasSubmitted(false);
            }}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
          >
            Clear input
          </button>
          <button
            type="submit"
            disabled={!text.trim() || isAnalyzing}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_35px_rgba(56,189,248,0.5)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-200 border-t-transparent" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Extract topics</span>
              </span>
            )}
          </button>
        </div>
      </form>

      {/* Results */}
      <div
        className="rounded-2xl border border-slate-800/70 bg-slate-900/80
        backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-slate-100">
              {view === "suggested" ? "Suggested topics" : "Review topics"}
            </h2>
            <p className="text-xs text-slate-400">
              {view === "suggested"
                ? "Auto-generated topics from the input content."
                : "Static review list (mocked for now)."}
            </p>
          </div>
          <div className="inline-flex rounded-full bg-slate-800/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setView("suggested")}
              className={`px-3 py-1 rounded-full transition-colors ${
                view === "suggested"
                  ? "bg-sky-500 text-slate-50"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Suggested
            </button>
            <button
              type="button"
              onClick={() => setView("review")}
              className={`px-3 py-1 rounded-full transition-colors ${
                view === "review"
                  ? "bg-sky-500 text-slate-50"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Review topics
            </button>
          </div>
        </div>

        {view === "suggested" ? (
          !hasSubmitted ? (
            <p className="text-xs text-slate-400">
              Paste some content or upload a text file, then click
              <span className="font-medium text-sky-300"> Extract topics</span>.
              Key terms and themes will appear here.
            </p>
          ) : topics.length === 0 ? (
            <p className="text-xs text-amber-300">
              We could not detect clear recurring terms. Try a longer passage
              or a different section of your material.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <li
                  key={topic}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-500/60 bg-slate-950/70 px-3 py-1 text-xs font-medium text-sky-100 shadow-[0_10px_30px_rgba(8,47,73,0.9)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="capitalize">{topic}</span>
                </li>
              ))}
            </ul>
          )
        ) : reviewTopics.length === 0 ? (
          <p className="text-xs text-slate-400">
            No topics available for review yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
              <span>Review, edit, or remove topics before approval.</span>
              <button
                type="button"
                onClick={() =>
                  setReviewTopics((prev) =>
                    prev.map((item) => ({ ...item, approved: true })),
                  )
                }
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              >
                Approve all topics
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {reviewTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={topic.approved}
                      onChange={(e) =>
                        setReviewTopics((prev) =>
                          prev.map((item) =>
                            item.id === topic.id
                              ? { ...item, approved: e.target.checked }
                              : item,
                          ),
                        )
                      }
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-slate-200"
                    />
                    {topic.isEditing ? (
                      <input
                        value={topic.draft}
                        onChange={(e) =>
                          setReviewTopics((prev) =>
                            prev.map((item) =>
                              item.id === topic.id
                                ? { ...item, draft: e.target.value }
                                : item,
                            ),
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                      />
                    ) : (
                      <span className="text-xs font-medium text-slate-100 capitalize">
                        {topic.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {topic.isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewTopics((prev) =>
                              prev.map((item) =>
                                item.id === topic.id
                                  ? {
                                      ...item,
                                      title: item.draft.trim() || item.title,
                                      isEditing: false,
                                      draft: item.draft.trim() || item.title,
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="rounded-lg border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewTopics((prev) =>
                              prev.map((item) =>
                                item.id === topic.id
                                  ? {
                                      ...item,
                                      isEditing: false,
                                      draft: item.title,
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="rounded-lg border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-slate-500"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewTopics((prev) =>
                              prev.map((item) =>
                                item.id === topic.id
                                  ? { ...item, isEditing: true }
                                  : item,
                              ),
                            )
                          }
                          className="rounded-lg border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewTopics((prev) =>
                              prev.filter((item) => item.id !== topic.id),
                            )
                          }
                          className="rounded-lg border border-rose-500/60 px-2 py-0.5 text-[11px] text-rose-300 hover:border-rose-400"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "suggested" && hasSubmitted && topics.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() =>
                navigate("/agent/syllabus", {
                  state: { fromTopicAgent: true, topics },
                })
              }
              className="inline-flex items-center gap-2 rounded-lg border border-sky-500/60 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/10 hover:border-sky-400"
            >
              <span>Use topics in Syllabus Builder</span>
            </button>
          </div>
        )}

        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          {view === "suggested"
            ? "Key topics are extracted from your material. You can send them to the Syllabus Builder or adjust them manually there."
            : "Use this review step to approve, edit, or remove topics before sharing with colleagues."}
        </p>
      </div>
    </div>
  );
}
