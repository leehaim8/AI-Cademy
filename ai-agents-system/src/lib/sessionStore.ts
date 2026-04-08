import type { Session, SessionRun } from "../types/course";
import {
  createBackendRun,
  createBackendSession,
  deleteBackendSession,
  fetchRunsForCourseAgent,
  fetchSessionRuns,
  fetchSessions,
} from "./api";

export const SESSION_STORE_CHANGED_EVENT = "ai-cademy-session-store-changed";

function notifySessionStoreChanged(): void {
  window.dispatchEvent(new Event(SESSION_STORE_CHANGED_EVENT));
}

export async function listSessions(courseId: string, agentKey: string): Promise<Session[]> {
  return fetchSessions(courseId, agentKey);
}

export async function createSession(
  courseId: string,
  agentKey: string,
  title: string,
  notes?: string,
): Promise<Session> {
  const session = await createBackendSession(courseId, agentKey, {
    title: title.trim(),
    notes: notes?.trim() || undefined,
  });
  notifySessionStoreChanged();
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteBackendSession(sessionId);
  notifySessionStoreChanged();
}

export async function listRuns(sessionId: string): Promise<SessionRun[]> {
  return fetchSessionRuns(sessionId);
}

export async function listRunsForCourseAgent(
  courseId: string,
  agentKey: string,
): Promise<SessionRun[]> {
  return fetchRunsForCourseAgent(courseId, agentKey);
}

export async function createRun(
  sessionId: string,
  input_data: unknown,
  output_data: unknown,
  status: SessionRun["status"],
): Promise<SessionRun> {
  const run = await createBackendRun(sessionId, {
    input_data,
    output_data,
    status,
  });
  notifySessionStoreChanged();
  return run;
}
