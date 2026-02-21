import { Link, useParams } from "react-router-dom";
import TopicAgentView from "./agents/TopicAgentView";
import SyllabusAgentView from "./agents/SyllabusAgentView";
import HomeworkAgentView from "./agents/HomeworkAgentView";
import EvaluationAgentView from "./agents/EvaluationAgentView";
import BookletAgentView from "./agents/BookletAgentView";
import CodeReviewAgentView from "./agents/CodeReviewAgentView";

const agentRegistry = {
  topic: {
    title: "Topic Extraction Agent",
    description:
      "Upload a syllabus, lesson plan or paste academic text to surface the key recurring topics.",
    Component: TopicAgentView,
  },
  syllabus: {
    title: "Syllabus Builder",
    description:
      "Sketch your course modules, learning outcomes and assessments in one structured workspace.",
    Component: SyllabusAgentView,
  },
  homework: {
    title: "Homework Generator",
    description:
      "Design prompts that generate practice questions, projects and homework sets.",
    Component: HomeworkAgentView,
  },
  evaluation: {
    title: "Homework Checking Agent",
    description:
      "Paste an assignment, rubric and student answer to get a suggested grade and feedback.",
    Component: EvaluationAgentView,
  },
  booklet: {
    title: "Course Booklet Generator",
    description:
      "Draft a cohesive booklet from your course units, summaries and activities.",
    Component: BookletAgentView,
  },
  "code-review": {
    title: "Pedagogical Code Review Agent",
    description:
      "Explore how to review code with an emphasis on learning, not only correctness.",
    Component: CodeReviewAgentView,
  },
} as const;

type AgentId = keyof typeof agentRegistry;

export default function AgentPage() {
  const { id } = useParams();
  const config = id && (agentRegistry[id as AgentId] ?? null);

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(236,72,153,0.22),_transparent_60%)]"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400">
            Agent workspace
          </p>
          <Link
            to="/home"
            className="text-xs font-medium text-slate-300 hover:text-sky-300 inline-flex items-center gap-1"
          >
            <span className="text-sm">←</span>
            <span>Back to dashboard</span>
          </Link>
        </div>

        {config ? (
          <>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 mb-3 tracking-tight">
              {config.title}
            </h1>
            <p className="text-sm text-slate-300 mb-8 max-w-2xl">
              {config.description}
            </p>

            <config.Component />
          </>
        ) : (
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-6 text-slate-200">
            <h1 className="text-xl font-semibold mb-2">Unknown agent</h1>
            <p className="text-sm text-slate-300">
              The requested agent does not exist yet. Go back to the
              dashboard and choose one of the existing workspaces.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
