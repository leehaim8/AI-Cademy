import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import TopicAgentView from "./agents/TopicAgentView";
import SyllabusAgentView from "./agents/SyllabusAgentView";
import HomeworkAgentView from "./agents/HomeworkAgentView";
import EvaluationAgentView from "./agents/EvaluationAgentView";
import BookletAgentView from "./agents/BookletAgentView";
import CodeReviewAgentView from "./agents/CodeReviewAgentView";
import SessionsPanel from "../components/SessionsPanel";
import { agentCatalog, getCourse } from "../lib/courseStore";
import type { SessionRun } from "../types/course";

const agentViews = {
  topic: {
    name: "Topic Extraction Agent",
    Component: TopicAgentView,
  },
  syllabus: {
    name: "Syllabus Builder",
    Component: SyllabusAgentView,
  },
  homework: {
    name: "Homework Generator",
    Component: HomeworkAgentView,
  },
  evaluation: {
    name: "Homework Checking Agent",
    Component: EvaluationAgentView,
  },
  booklet: {
    name: "Course Booklet Generator",
    Component: BookletAgentView,
  },
  "code-review": {
    name: "Pedagogical Code Review Agent",
    Component: CodeReviewAgentView,
  },
} as const;

type AgentKey = keyof typeof agentViews;

export default function CourseAgentPage() {
  const { courseId = "", agentKey = "" } = useParams();
  const [selectedRun, setSelectedRun] = useState<SessionRun | null>(null);
  const normalizedKey = agentKey.replace("_", "-") as AgentKey;
  const agent = agentViews[normalizedKey];
  const course = courseId ? getCourse(courseId) : null;
  const agentMeta = agentCatalog.find(
    (entry) => entry.key === agentKey.replace("-", "_"),
  );

  if (!agent) {
    return (
      <div
        className="min-h-screen px-6 py-10
        bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_55%),
        radial-gradient(circle_at_bottom,_rgba(236,72,153,0.22),_transparent_60%)]"
      >
        <div className="max-w-5xl mx-auto rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-6 text-slate-200">
          <h1 className="text-xl font-semibold mb-2">Unknown agent</h1>
          <p className="text-sm text-slate-300">
            The requested agent does not exist yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(236,72,153,0.22),_transparent_60%)]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400">
            Agent workspace
          </p>
          <Link
            to={courseId ? `/courses/${courseId}/agents` : "/courses"}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-sky-300"
          >
            <span className="text-sm">←</span>
            <span>Back to course</span>
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 tracking-tight">
            {agent.name}
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-2xl">
            {agentMeta?.description ?? "Agent workspace for this course."}
          </p>
          {course ? (
            <p className="text-xs text-slate-400 mt-2">
              Course: {course.name}
            </p>
          ) : null}
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <div className="h-full">
            <SessionsPanel
              courseId={courseId}
              agentKey={agentKey}
              onRunSelect={setSelectedRun}
            />
          </div>
          <div className="h-full">
            {normalizedKey === "syllabus" ? (
              <SyllabusAgentView
                selectedRun={selectedRun}
                onClearSelectedRun={() => setSelectedRun(null)}
              />
            ) : normalizedKey === "topic" ? (
              <TopicAgentView />
            ) : normalizedKey === "homework" ? (
              <HomeworkAgentView />
            ) : normalizedKey === "evaluation" ? (
              <EvaluationAgentView />
            ) : normalizedKey === "booklet" ? (
              <BookletAgentView />
            ) : (
              <CodeReviewAgentView />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
