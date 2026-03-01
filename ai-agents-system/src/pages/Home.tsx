import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AgentCard from "../components/AgentCard";
import { getCurrentUser } from "../lib/authStorage";
import { listEnabledAgents } from "../lib/courseStore";

export default function Home() {
  const currentUser = getCurrentUser();
  const firstName = currentUser?.full_name?.split(" ")[0] ?? "there";
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId") ?? "";

  const agents = [
    {
      id: "topic",
      title: "Topic Extraction Agent",
      description: "Extracts key topics from academic content.",
      emoji: "🧠",
    },
    {
      id: "syllabus",
      title: "Syllabus Builder",
      description: "Builds structured course syllabi automatically.",
      emoji: "📚",
    },
    {
      id: "homework",
      title: "Homework Generator",
      description: "Generates personalized homework assignments.",
      emoji: "📝",
    },
    {
      id: "evaluation",
      title: "Homework Checking Agent",
      description:
        "Checks homework against your rubric and suggests a grade.",
      emoji: "✅",
    },
    {
      id: "booklet",
      title: "Course Booklet Generator",
      description: "Creates a full course booklet.",
      emoji: "📘",
    },
    {
      id: "code-review",
      title: "Pedagogical Code Review Agent",
      description:
        "Creates a sample solution and explains a pedagogical code review (demo only).",
      emoji: "💻",
    },
  ];

  const enabledAgents = useMemo(() => {
    if (!courseId) return null;
    return listEnabledAgents(courseId);
  }, [courseId]);

  const filteredAgents = useMemo(() => {
    if (!courseId || !enabledAgents) return agents;
    return agents.filter((agent) => {
      const normalized = agent.id.replace("-", "_");
      return Boolean(enabledAgents[normalized]);
    });
  }, [agents, courseId, enabledAgents]);

  const showEmptyState =
    Boolean(courseId) && enabledAgents && filteredAgents.length === 0;

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(129,140,248,0.26),_transparent_60%)]"
    >
      <header className="mb-10 flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400">
          AI CADEMY platform
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 tracking-tight">
          Welcome back, {firstName} 👋
        </h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Pick an agent to help you design courses, generate assignments
          and analyze student work. Each workspace is optimized for
          AI‑powered teaching workflows.
        </p>
      </header>

      {showEmptyState ? (
        <div className="mb-6 rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>No agents enabled for this course yet.</span>
            <Link
              to={`/courses/${courseId}/settings`}
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              Choose agents for this course
            </Link>
          </div>
        </div>
      ) : null}

      <div
        className="
          grid gap-6
          sm:grid-cols-1
          md:grid-cols-2
          lg:grid-cols-3
        "
      >
        {filteredAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            title={agent.title}
            description={agent.description}
            route={
              courseId
                ? `/courses/${courseId}/agents/${agent.id.replace("-", "_")}`
                : `/agent/${agent.id}`
            }
            emoji={agent.emoji}
          />
        ))}
      </div>
    </div>
  );
}
