import type { AuthResponse, User } from "../types/auth";
import type { Session, SessionRun } from "../types/course";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type SignUpPayload = {
  full_name: string;
  email: string;
  password: string;
};

type SignInPayload = {
  email: string;
  password: string;
};

export type TopicExtractionPayload = {
  seminar_topic: string;
  raw_text?: string;
  sources?: string[];
  similarity_threshold?: number;
  include_summary?: boolean;
};

export type TopicExtractionResponse = {
  run_id?: string | null;
  all_topics: string[];
  clusters: string[][];
  summary_md?: string | null;
};

export type TopicExtractionEditPayload = {
  run_id: string;
  edited_topics: string[];
};

export type TopicExtractionRunSummary = {
  run_id: string;
  source_type?: string;
  seminar_topic?: string;
  created_at?: string;
  updated_at?: string;
  total_topics: number;
  edited_topics_count: number;
};

export type TopicExtractionRun = {
  run_id: string;
  source_type?: string;
  seminar_topic?: string;
  created_at?: string;
  updated_at?: string;
  all_topics: string[];
  edited_topics: string[];
  clusters: string[][];
  summary_md?: string | null;
};

export type SyllabusGenerationPayload = {
  topics: string[];
  num_weeks: number;
  audience: string;
  constraints?: string;
};

export type SyllabusWeek = {
  week: number;
  central_topic: string;
  topics: string[];
};

export type SyllabusGenerationResponse = {
  weeks: SyllabusWeek[];
};

export type BookletOutlineUnit = {
  title: string;
  topics: string[];
};

export type BookletOutlinePayload = {
  syllabus_text?: string;
  weeks?: SyllabusWeek[];
  course_name?: string;
};

export type BookletOutlineResponse = {
  outline: BookletOutlineUnit[];
  course_map: Record<string, unknown>;
  source_type?: string | null;
  course_name?: string | null;
};

export type BookletChapterPayload = {
  chapter_name: string;
  course_map: Record<string, unknown>;
  output_language?: "Hebrew" | "English";
  tone?: "Student-friendly" | "Academic" | "Concise";
};

export type BookletChapterResponse = {
  chapter_name: string;
  draft_md: string;
  final_md: string;
};

export type HomeworkDifficulty = "easy" | "medium" | "difficult";

export type HomeworkGenerationPayload = {
  chapter_text: string;
  chapter_title?: string;
  mcq_question_count: number;
  open_question_count: number;
  base_difficulty: HomeworkDifficulty;
  points_per_question: number;
  mcq_option_count: number;
  mcq_correct_count: number;
};

export type HomeworkUploadPayload = Omit<HomeworkGenerationPayload, "chapter_text"> & {
  file: File;
};

export type HomeworkOption = {
  label: string;
  text: string;
  is_correct: boolean;
};

export type HomeworkQuestion = {
  id: string;
  type: "mcq" | "open";
  difficulty: HomeworkDifficulty;
  points: number;
  prompt: string;
  student_answer: string;
  grading_criteria: string[];
  options: HomeworkOption[];
  correct_answers_count?: number | null;
};

export type HomeworkGenerationResponse = {
  chapter_title?: string | null;
  questions: HomeworkQuestion[];
};

export type TopicExtractionUploadPayload = {
  seminar_topic: string;
  files: File[];
  raw_text?: string;
  similarity_threshold?: number;
  include_summary?: boolean;
};

export type SessionCreatePayload = {
  title: string;
  notes?: string;
};

export type SessionRunCreatePayload = {
  input_data: unknown;
  output_data: unknown;
  status: SessionRun["status"];
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string };
    return data.detail ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export async function signUp(payload: SignUpPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as AuthResponse;
}

export async function signIn(payload: SignInPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as AuthResponse;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/users`);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { users: User[] };
  return data.users;
}

export async function fetchUser(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}`);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { user: User };
  return data.user;
}

export async function fetchSessions(
  courseId: string,
  agentKey: string,
): Promise<Session[]> {
  const res = await fetch(`${API_BASE_URL}/courses/${courseId}/agents/${agentKey}/sessions`);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { sessions: Session[] };
  return data.sessions;
}

export async function createBackendSession(
  courseId: string,
  agentKey: string,
  payload: SessionCreatePayload,
): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}/courses/${courseId}/agents/${agentKey}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { session: Session };
  return data.session;
}

export async function deleteBackendSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchSessionRuns(sessionId: string): Promise<SessionRun[]> {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/runs`);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { runs: SessionRun[] };
  return data.runs;
}

export async function fetchRunsForCourseAgent(
  courseId: string,
  agentKey: string,
): Promise<SessionRun[]> {
  const res = await fetch(
    `${API_BASE_URL}/courses/${courseId}/agents/${agentKey}/session-runs`,
  );
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { runs: SessionRun[] };
  return data.runs;
}

export async function createBackendRun(
  sessionId: string,
  payload: SessionRunCreatePayload,
): Promise<SessionRun> {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { run: SessionRun };
  return data.run;
}

export async function updateUser(
  userId: string,
  payload: { full_name: string }
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as AuthResponse;
}

export async function extractTopics(
  payload: TopicExtractionPayload
): Promise<TopicExtractionResponse> {
  const res = await fetch(`${API_BASE_URL}/topic-extraction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as TopicExtractionResponse;
}

export async function extractTopicsWithFiles(
  payload: TopicExtractionUploadPayload
): Promise<TopicExtractionResponse> {
  const formData = new FormData();
  formData.append("seminar_topic", payload.seminar_topic);
  formData.append(
    "similarity_threshold",
    String(payload.similarity_threshold ?? 0.68)
  );
  formData.append("include_summary", String(payload.include_summary ?? false));

  if (payload.raw_text?.trim()) {
    formData.append("raw_text", payload.raw_text.trim());
  }

  payload.files.forEach((file) => {
    formData.append("files", file, file.name);
  });

  const res = await fetch(`${API_BASE_URL}/topic-extraction/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as TopicExtractionResponse;
}

export async function saveEditedTopics(
  payload: TopicExtractionEditPayload
): Promise<{ run_id: string; edited_topics: string[] }> {
  const res = await fetch(`${API_BASE_URL}/topic-extraction/${payload.run_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edited_topics: payload.edited_topics }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as { run_id: string; edited_topics: string[] };
}

export async function listTopicExtractionRuns(
  limit = 20
): Promise<TopicExtractionRunSummary[]> {
  const res = await fetch(`${API_BASE_URL}/topic-extraction/runs?limit=${limit}`);

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { runs: TopicExtractionRunSummary[] };
  return data.runs;
}

export async function getTopicExtractionRun(
  runId: string
): Promise<TopicExtractionRun> {
  const res = await fetch(`${API_BASE_URL}/topic-extraction/runs/${runId}`);

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { run: TopicExtractionRun };
  return data.run;
}

export async function generateSyllabus(
  payload: SyllabusGenerationPayload
): Promise<SyllabusGenerationResponse> {
  const res = await fetch(`${API_BASE_URL}/syllabus/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as SyllabusGenerationResponse;
}

export async function generateBookletOutline(
  payload: BookletOutlinePayload
): Promise<BookletOutlineResponse> {
  const res = await fetch(`${API_BASE_URL}/booklet/outline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as BookletOutlineResponse;
}

export async function generateBookletOutlineWithFile(
  file: File,
  courseName?: string
): Promise<BookletOutlineResponse> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  if (courseName?.trim()) {
    formData.append("course_name", courseName.trim());
  }

  const res = await fetch(`${API_BASE_URL}/booklet/outline/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as BookletOutlineResponse;
}

export async function generateBookletChapter(
  payload: BookletChapterPayload
): Promise<BookletChapterResponse> {
  const res = await fetch(`${API_BASE_URL}/booklet/chapter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as BookletChapterResponse;
}

export async function generateHomework(
  payload: HomeworkGenerationPayload
): Promise<HomeworkGenerationResponse> {
  const res = await fetch(`${API_BASE_URL}/homework/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as HomeworkGenerationResponse;
}

export async function generateHomeworkWithFile(
  payload: HomeworkUploadPayload
): Promise<HomeworkGenerationResponse> {
  const formData = new FormData();
  formData.append("file", payload.file, payload.file.name);
  if (payload.chapter_title?.trim()) {
    formData.append("chapter_title", payload.chapter_title.trim());
  }
  formData.append("mcq_question_count", String(payload.mcq_question_count));
  formData.append("open_question_count", String(payload.open_question_count));
  formData.append("base_difficulty", payload.base_difficulty);
  formData.append("points_per_question", String(payload.points_per_question));
  formData.append("mcq_option_count", String(payload.mcq_option_count));
  formData.append("mcq_correct_count", String(payload.mcq_correct_count));

  const res = await fetch(`${API_BASE_URL}/homework/generate/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as HomeworkGenerationResponse;
}
