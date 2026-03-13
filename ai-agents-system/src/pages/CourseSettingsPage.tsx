import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  agentCatalog,
  listEnabledAgents,
  setEnabledAgents,
} from "../lib/courseStore";
import { getCourse } from "../lib/courseStore";

export default function CourseSettingsPage() {
  const navigate = useNavigate();
  const { courseId = "" } = useParams();
  const course = courseId ? getCourse(courseId) : null;
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    courseId ? listEnabledAgents(courseId) : {},
  );

  const agents = useMemo(() => agentCatalog, []);
  const normalizedEnabled = useMemo(
    () =>
      Object.fromEntries(
        agentCatalog.map((agent) => [
          agent.key,
          enabled[agent.key] ?? true,
        ]),
      ),
    [enabled],
  );

  function handleToggle(agentKey: string, value: boolean) {
    if (!courseId) return;
    const next = { ...enabled, [agentKey]: value };
    setEnabled(next);
    setEnabledAgents(courseId, next);
  }

  function handleClearAll() {
    if (!courseId) return;
    const cleared = Object.fromEntries(
      agentCatalog.map((agent) => [agent.key, false]),
    );
    setEnabled(cleared);
    setEnabledAgents(courseId, cleared);
  }

  function handleConfirm() {
    if (courseId) {
      setEnabledAgents(courseId, normalizedEnabled);
      navigate(`/courses/${courseId}/agents`);
      return;
    }
    navigate("/courses");
  }

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(129,140,248,0.26),_transparent_60%)]"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400">
              Course settings
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 tracking-tight">
              Choose agents for this course
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {course ? `Course: ${course.name}` : "Select a course to edit."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
            >
              OK
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
          <div className="flex flex-col gap-4">
            {courseId ? (
              agents.map((agent) => {
                const isEnabled = enabled[agent.key] ?? true;
                return (
                  <div
                    key={agent.key}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <h2 className="text-sm font-semibold text-slate-100">
                        {agent.name}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {agent.description}
                      </p>
                    </div>
                    <label className="flex items-center gap-3 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(event) =>
                          handleToggle(agent.key, event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-slate-200"
                      />
                      <span>{isEnabled ? "Enabled" : "Disabled"}</span>
                    </label>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">
                Missing courseId in the URL.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

