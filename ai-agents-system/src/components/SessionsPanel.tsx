import { useEffect, useMemo, useState } from "react";
import type { Session, SessionRun } from "../types/course";
import {
  SESSION_STORE_CHANGED_EVENT,
  createSession,
  deleteSession,
  listRuns,
  listSessions,
} from "../lib/sessionStore";

type SessionsPanelProps = {
  courseId: string;
  agentKey: string;
  onRunSelect?: (run: SessionRun | null) => void;
  showCreate?: boolean;
  emptyHint?: string;
};

export default function SessionsPanel({
  courseId,
  agentKey,
  onRunSelect,
  showCreate = true,
  emptyHint,
}: SessionsPanelProps) {
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
      : null;

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

  function handleSelectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    onRunSelect?.(listRuns(sessionId)[0] ?? null);
  }

  function handleCloseSession() {
    setSelectedSessionId(null);
    onRunSelect?.(null);
  }

  function handleCreateSession() {
    if (!title.trim()) return;
    createSession(courseId, agentKey, title, notes);
    setTitle("");
    setNotes("");
    setSelectedSessionId(null);
  }

  function handleDeleteSession(sessionId: string) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this session?",
    );
    if (!shouldDelete) {
      return;
    }

    if (effectiveSelectedSessionId === sessionId) {
      onRunSelect?.(null);
    }
    deleteSession(sessionId);
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex-1 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Sessions</h2>
        </div>

        <div className="mt-4 flex max-h-[14rem] flex-col gap-2 overflow-y-auto pr-1 text-xs text-slate-300">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400">
              {emptyHint ?? "No sessions yet. Create one to start."}
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`min-h-[6.5rem] rounded-xl border px-3 py-2 text-left transition ${
                  effectiveSelectedSessionId === session.id
                    ? "border-sky-400/60 bg-sky-500/10 text-slate-100"
                    : "border-slate-800/70 bg-slate-950/40 text-slate-300 hover:border-slate-600"
                }`}
              >
                <div className="flex h-full items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectSession(session.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div
                      className="line-clamp-2 min-h-[3.5rem] text-sm font-semibold leading-snug"
                      title={session.title}
                    >
                      {session.title}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {new Date(session.created_at).toLocaleDateString()}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {effectiveSelectedSessionId === session.id ? (
                      <button
                        type="button"
                        onClick={handleCloseSession}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        aria-label={`Close session ${session.title}`}
                        title="Close session"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:border-rose-400 hover:text-rose-300"
                      aria-label={`Delete session ${session.title}`}
                      title="Delete session"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreate ? (
        <div className="flex-1 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-slate-100">New session</h3>
          <div className="mt-3 flex h-[calc(100%-1.75rem)] flex-col gap-3">
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
              className="min-h-[8rem] flex-1 rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
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
      ) : null}

      <div className="flex-1 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Run history</h3>
          <p className="text-xs text-slate-400">
            {selectedSession ? selectedSession.title : "Select a session"}
          </p>
        </div>
        <div className="mt-3 flex max-h-[14rem] flex-col gap-2 overflow-y-auto pr-1 text-xs text-slate-300">
          {runs.length === 0 ? (
            <p className="text-xs text-slate-400">
              No runs yet. Click Run to create one.
            </p>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onRunSelect?.(run)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-left hover:border-slate-600"
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
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
