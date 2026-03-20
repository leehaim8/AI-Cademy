import { useEffect, useMemo, useState } from "react";
import type { Session, SessionRun } from "../types/course";
import {
  SESSION_STORE_CHANGED_EVENT,
  createRun,
  createSession,
  listRuns,
  listSessions,
} from "../lib/sessionStore";

type SessionsPanelProps = {
  courseId: string;
  agentKey: string;
};

export default function SessionsPanel({ courseId, agentKey }: SessionsPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [storeVersion, setStoreVersion] = useState(0);

  useEffect(() => {
    const handleStoreChanged = () => {
      setStoreVersion((prev) => prev + 1);
    };

    window.addEventListener(SESSION_STORE_CHANGED_EVENT, handleStoreChanged);
    return () => {
      window.removeEventListener(SESSION_STORE_CHANGED_EVENT, handleStoreChanged);
    };
  }, []);

  const sessions = useMemo<Session[]>(() => {
    void storeVersion;
    if (!courseId || !agentKey) {
      return [];
    }
    return listSessions(courseId, agentKey);
  }, [courseId, agentKey, storeVersion]);

  const effectiveSelectedSessionId =
    selectedSessionId && sessions.some((session) => session.id === selectedSessionId)
      ? selectedSessionId
      : sessions[0]?.id ?? null;

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === effectiveSelectedSessionId) ?? null,
    [sessions, effectiveSelectedSessionId],
  );

  const runs = useMemo<SessionRun[]>(() => {
    void storeVersion;
    if (!effectiveSelectedSessionId) {
      return [];
    }
    return listRuns(effectiveSelectedSessionId);
  }, [effectiveSelectedSessionId, storeVersion]);

  function handleCreateSession() {
    if (!title.trim()) return;
    const session = createSession(courseId, agentKey, title, notes);
    setSessions((prev) => [session, ...prev]);
    setTitle("");
    setNotes("");
    setSelectedSessionId(session.id);
  }

  function handleRunMock() {
    if (!selectedSession) return;
    const run = createRun(
      selectedSession.id,
      { note: "Mock input" },
      { note: "Mock output" },
      "success",
    );
    setRuns((prev) => [run, ...prev]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Sessions</h2>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-xs text-slate-300">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400">
              No sessions yet. Create one to start.
            </p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  effectiveSelectedSessionId === session.id
                    ? "border-sky-400/60 bg-sky-500/10 text-slate-100"
                    : "border-slate-800/70 bg-slate-950/40 text-slate-300 hover:border-slate-600"
                }`}
              >
                <div className="text-sm font-semibold">{session.title}</div>
                <div className="text-[11px] text-slate-400">
                  {new Date(session.created_at).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
        <h3 className="text-sm font-semibold text-slate-100">New session</h3>
        <div className="mt-3 flex flex-col gap-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Session title"
            className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes (optional)"
            rows={3}
            className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
          />
          <button
            type="button"
            onClick={handleCreateSession}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white"
          >
            Create session
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Run history</h3>
            <p className="text-xs text-slate-400">
              {selectedSession ? selectedSession.title : "Select a session"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunMock}
            disabled={!selectedSession}
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run (mock)
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-xs text-slate-300">
          {runs.length === 0 ? (
            <p className="text-xs text-slate-400">
              No runs yet. Click Run to create one.
            </p>
          ) : (
            runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-500">
                    {new Date(run.created_at).toLocaleTimeString()}
                  </span>
                  <span className="text-xs text-slate-200">
                    {run.status === "success"
                      ? "Run completed"
                      : run.status === "error"
                        ? "Run failed"
                        : "Running"}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    run.status === "success"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : run.status === "error"
                        ? "bg-rose-500/20 text-rose-200"
                        : "bg-slate-700/40 text-slate-300"
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
