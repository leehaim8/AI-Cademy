import type { AuthResponse, User } from "../types/auth";

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

export type TopicExtractionUploadPayload = {
  seminar_topic: string;
  files: File[];
  raw_text?: string;
  similarity_threshold?: number;
  include_summary?: boolean;
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
