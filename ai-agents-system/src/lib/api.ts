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
