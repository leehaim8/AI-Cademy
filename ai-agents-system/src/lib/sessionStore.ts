import type { Session, SessionRun } from "../types/course";

const SESSIONS_KEY = "ai-cademy-sessions";
const RUNS_KEY = "ai-cademy-session-runs";

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
  return session;
}

export function updateSession(sessionId: string, fields: SessionUpdate): Session | null {
  const sessions = readJson<Session[]>(SESSIONS_KEY, []);
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) return null;
  const updated = { ...sessions[index], ...fields };
  sessions[index] = updated;
  writeJson(SESSIONS_KEY, sessions);
  return updated;
}

export function listRuns(sessionId: string): SessionRun[] {
  const runs = readJson<SessionRun[]>(RUNS_KEY, []);
  return runs.filter((run) => run.session_id === sessionId);
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
  return run;
}
