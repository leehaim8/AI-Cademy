import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { fetchUser, updateUser } from "../lib/api";
import { getCurrentUser, setCurrentUser } from "../lib/authStorage";

export default function SettingsPage() {
  const currentUser = getCurrentUser();
  const [fullName, setFullName] = useState(currentUser?.full_name ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [createdAt, setCreatedAt] = useState(currentUser?.created_at ?? "");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadUser() {
      if (!currentUser) {
        return;
      }

      try {
        const user = await fetchUser(currentUser.id);
        setFullName(user.full_name);
        setEmail(user.email);
        setCreatedAt(user.created_at);
        setCurrentUser(user);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load profile.";
        setError(message);
      } finally {
        setBootLoading(false);
      }
    }

    void loadUser();
  }, [currentUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await updateUser(currentUser.id, { full_name: fullName });
      setCurrentUser(response.user);
      setFullName(response.user.full_name);
      setEmail(response.user.email);
      setCreatedAt(response.user.created_at);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(129,140,248,0.2),_transparent_60%)]"
    >
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400 mb-2">
          Account
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 tracking-tight mb-3">
          Settings
        </h1>
        <p className="text-sm text-slate-300 mb-8">
          Manage your profile details.
        </p>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl p-7 shadow-[0_18px_45px_rgba(15,23,42,0.85)]">
          {bootLoading ? (
            <p className="text-slate-300">Loading profile...</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="text-left text-sm text-slate-200">
                Full Name
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  minLength={2}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
                />
              </label>

              <label className="text-left text-sm text-slate-200">
                Email
                <input
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-400 cursor-not-allowed"
                />
              </label>

              <label className="text-left text-sm text-slate-200">
                Created At
                <input
                  type="text"
                  value={createdAt ? new Date(createdAt).toLocaleString() : ""}
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-400 cursor-not-allowed"
                />
              </label>

              {error && <p className="text-sm text-rose-300">{error}</p>}
              {success && <p className="text-sm text-emerald-300">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 font-medium text-white disabled:opacity-70"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
