import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AgentCard from "../components/AgentCard";
import { useCourse } from "../hooks/useCourse";
import {
  agentCatalog,
  getAgentAvailability,
  listEnabledAgents,
  setEnabledAgents,
} from "../lib/courseStore";

const agents = [
  {
    id: "topic",
    title: "Topic Extraction Agent",
    description: "Extracts key topics from academic content.",
    emoji: "🧠",
  },
  {
    id: "syllabus",
    title: "Syllabus Flow Agent",
    description: "Structured course syllabi automatically",
    emoji: "📚",
  },
  {
    id: "booklet",
    title: "Course Booklet Generator",
    description: "Generates a syllabus-aligned chapter draft",
    emoji: "📘",
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
    id: "code-review",
    title: "Pedagogical Code Review Agent",
    description: "Creates a sample solution and reviews it.",
    emoji: "💻",
  },
] as const;

export default function Home() {
  const { courseId = "" } = useParams();
  const [agentState, setAgentState] = useState<Record<string, boolean> | null>(
    courseId ? getAgentAvailability(courseId) : null,
  );
  const [showManager, setShowManager] = useState(false);
  const { course } = useCourse(courseId);
  const headline = course ? `Agents for ${course.name}` : "Choose an agent";

  const enabledAgents = useMemo(() => {
    if (!courseId) return null;
    return agentState ?? listEnabledAgents(courseId);
  }, [agentState, courseId]);

  const filteredAgents = useMemo(() => {
    if (!courseId || !enabledAgents) return agents;
    return agents.filter((agent) => {
      const normalized = agent.id.replace("-", "_");
      return Boolean(enabledAgents[normalized]);
    });
  }, [courseId, enabledAgents]);

  const allAgentsEnabled = useMemo(
    () =>
      Boolean(enabledAgents) &&
      agentCatalog.every((agent) => Boolean(enabledAgents?.[agent.key])),
    [enabledAgents],
  );

  function handleToggleAgent(agentKey: string) {
    if (!courseId || !enabledAgents) return;
    const isEnabled = enabledAgents[agentKey] ?? true;
    if (isEnabled) {
      const agentName =
        agentCatalog.find((agent) => agent.key === agentKey)?.name ?? "this agent";
      const shouldRemove = window.confirm(
        `Are you sure you want to remove ${agentName} from this course?`,
      );
      if (!shouldRemove) {
        return;
      }
    }
    const next = {
      ...enabledAgents,
      [agentKey]: !isEnabled,
    };
    setAgentState(next);
    setEnabledAgents(courseId, next);
  }

  function handleEnableAllAgents() {
    if (!courseId) return;

    const next = Object.fromEntries(
      agentCatalog.map((agent) => [agent.key, true]),
    );
    setAgentState(next);
    setEnabledAgents(courseId, next);
  }

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 tracking-tight">
            {headline}
          </h1>
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-sky-300"
          >
            <span className="text-sm">←</span>
            <span>Back to all courses</span>
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-slate-300">
          Choose an agent to build courses, create assignments, and review
          student work
        </p>
      </header>

      {courseId ? (
        <div className="mb-6 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400">
                Course agents
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Add or remove agents for this specific course
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManager((prev) => !prev)}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
            >
              {showManager ? "Hide agent manager" : "Manage agents"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {agentCatalog.map((agent) => {
              const isEnabled = enabledAgents?.[agent.key] ?? true;
              return (
                <span
                  key={agent.key}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    isEnabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700 bg-slate-950/70 text-slate-500"
                  }`}
                >
                  {agent.name}
                </span>
              );
            })}
          </div>

          {showManager ? (
            <div className="mt-4">
              <div className="mb-3 flex justify-end">
                {!allAgentsEnabled ? (
                  <button
                    type="button"
                    onClick={handleEnableAllAgents}
                    className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-400"
                  >
                    Choose all agents
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
              {agentCatalog.map((agent) => {
                const isEnabled = enabledAgents?.[agent.key] ?? true;
                return (
                  <div
                    key={agent.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/50 p-4"
                  >
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-slate-100">
                        {agent.name}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        {agent.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleAgent(agent.key)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        isEnabled
                          ? "border border-rose-500/50 bg-rose-500/10 text-rose-200 hover:border-rose-400"
                          : "border border-sky-500/50 bg-sky-500/10 text-sky-200 hover:border-sky-400"
                      }`}
                    >
                      {isEnabled ? "Remove agent" : "Add agent"}
                    </button>
                  </div>
                );
              })}
            </div>
            </div>
          ) : null}
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
