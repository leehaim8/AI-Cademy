import type { Session, SessionRun } from "../types/course";

const SESSIONS_KEY = "ai-cademy-sessions";
const RUNS_KEY = "ai-cademy-session-runs";
export const SESSION_STORE_CHANGED_EVENT = "ai-cademy-session-store-changed";

type SessionUpdate = Partial<Pick<Session, "title" | "notes">>;

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function notifySessionStoreChanged(): void {
  window.dispatchEvent(new Event(SESSION_STORE_CHANGED_EVENT));
}

export function listSessions(courseId: string, agentKey: string): Session[] {
  const sessions = readJson<Session[]>(SESSIONS_KEY, []);
  return sessions.filter(
    (session) =>
      session.course_id === courseId && session.agent_key === agentKey,
  );
}

export function createSession(
  courseId: string,
  agentKey: string,
  title: string,
  notes?: string,
): Session {
  const sessions = readJson<Session[]>(SESSIONS_KEY, []);
  const session: Session = {
    id: crypto.randomUUID(),
    course_id: courseId,
    agent_key: agentKey,
    title: title.trim(),
    notes: notes?.trim() || undefined,
    created_at: new Date().toISOString(),
  };
  sessions.unshift(session);
  writeJson(SESSIONS_KEY, sessions);
  notifySessionStoreChanged();
  return session;
}

export function updateSession(sessionId: string, fields: SessionUpdate): Session | null {
  const sessions = readJson<Session[]>(SESSIONS_KEY, []);
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) return null;
  const updated = { ...sessions[index], ...fields };
  sessions[index] = updated;
  writeJson(SESSIONS_KEY, sessions);
  notifySessionStoreChanged();
  return updated;
}

export function deleteSession(sessionId: string): void {
  const sessions = readJson<Session[]>(SESSIONS_KEY, []).filter(
    (session) => session.id !== sessionId,
  );
  writeJson(SESSIONS_KEY, sessions);

  const runs = readJson<SessionRun[]>(RUNS_KEY, []).filter(
    (run) => run.session_id !== sessionId,
  );
  writeJson(RUNS_KEY, runs);

  notifySessionStoreChanged();
}

export function listRuns(sessionId: string): SessionRun[] {
  const runs = readJson<SessionRun[]>(RUNS_KEY, []);
  return runs.filter((run) => run.session_id === sessionId);
}

export function listRunsForCourseAgent(
  courseId: string,
  agentKey: string,
): SessionRun[] {
  const sessions = listSessions(courseId, agentKey);
  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = new Set(sessions.map((session) => session.id));
  const runs = readJson<SessionRun[]>(RUNS_KEY, []);
  return runs.filter((run) => sessionIds.has(run.session_id));
}

export function createRun(
  sessionId: string,
  input_data: unknown,
  output_data: unknown,
  status: SessionRun["status"],
): SessionRun {
  const runs = readJson<SessionRun[]>(RUNS_KEY, []);
  const run: SessionRun = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    input_data,
    output_data,
    status,
    created_at: new Date().toISOString(),
  };
  runs.unshift(run);
  writeJson(RUNS_KEY, runs);
  notifySessionStoreChanged();
  return run;
}
