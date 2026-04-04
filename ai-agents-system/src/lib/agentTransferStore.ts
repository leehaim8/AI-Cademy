import type { SyllabusWeek } from "./api";

const BOOKLET_TRANSFER_KEY = "ai-cademy-booklet-transfer";

export type BookletTransferPayload = {
  courseId: string;
  weeks: SyllabusWeek[];
  topics: string[];
  audience: string;
  constraints: string;
  createdAt: string;
};

function readTransfer(): BookletTransferPayload | null {
  const raw = localStorage.getItem(BOOKLET_TRANSFER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as BookletTransferPayload;
  } catch {
    return null;
  }
}

export function saveBookletTransfer(
  payload: Omit<BookletTransferPayload, "createdAt">,
): void {
  localStorage.setItem(
    BOOKLET_TRANSFER_KEY,
    JSON.stringify({
      ...payload,
      createdAt: new Date().toISOString(),
    }),
  );
}

export function loadBookletTransfer(
  courseId: string,
): BookletTransferPayload | null {
  const payload = readTransfer();
  if (!payload) {
    return null;
  }
  if (payload.courseId !== courseId) {
    return null;
  }
  if (!Array.isArray(payload.weeks) || payload.weeks.length === 0) {
    return null;
  }
  return payload;
}

export function clearBookletTransfer(courseId: string): void {
  const payload = readTransfer();
  if (!payload || payload.courseId !== courseId) {
    return;
  }
  localStorage.removeItem(BOOKLET_TRANSFER_KEY);
}
