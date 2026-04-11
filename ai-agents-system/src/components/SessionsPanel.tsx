import { useEffect, useState } from "react";
import type { Session, SessionRun } from "../types/course";
import {
  SESSION_STORE_CHANGED_EVENT,
  deleteSession,
  listRuns,
  listSessions,
} from "../lib/sessionStore";

type SessionsPanelProps = {
  courseId: string;
  agentKey: string;
  onRunSelect?: (run: SessionRun | null) => void;
  emptyHint?: string;
  title?: string;
};

export default function SessionsPanel({
  courseId,
  agentKey,
  onRunSelect,
  emptyHint,
  title = "Temporary",
}: SessionsPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [storeVersion, setStoreVersion] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const handleStoreChanged = () => {
      setStoreVersion((prev) => prev + 1);
    };

    window.addEventListener(SESSION_STORE_CHANGED_EVENT, handleStoreChanged);
    return () => {
      window.removeEventListener(SESSION_STORE_CHANGED_EVENT, handleStoreChanged);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      if (!courseId || !agentKey) {
        setSessions([]);
        return;
      }

      try {
        const nextSessions = await listSessions(courseId, agentKey);
        if (!cancelled) {
          setSessions(nextSessions);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      }
    }

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [courseId, agentKey, storeVersion]);

  const effectiveSelectedSessionId =
    selectedSessionId && sessions.some((session) => session.id === selectedSessionId)
      ? selectedSessionId
      : null;

  async function handleSelectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    try {
      const sessionRuns = await listRuns(sessionId);
      onRunSelect?.(sessionRuns[0] ?? null);
    } catch {
      onRunSelect?.(null);
    }
  }

  function handleCloseSession() {
    setSelectedSessionId(null);
    onRunSelect?.(null);
  }

  async function handleDeleteSession(sessionId: string) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this session?",
    );
    if (!shouldDelete) {
      return;
    }

    if (effectiveSelectedSessionId === sessionId) {
      onRunSelect?.(null);
    }
    try {
      await deleteSession(sessionId);
    } catch {
      return;
    }
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    }
  }

  return (
    <div className="h-full rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        </div>

        <div className="booklet-scroll mt-4 flex max-h-[14rem] flex-col gap-2 overflow-y-auto pr-1 text-xs text-slate-300">
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
  );
}
