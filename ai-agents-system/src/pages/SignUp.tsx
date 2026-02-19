import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { signUp } from "../lib/api";
import { getCurrentUser, setCurrentUser } from "../lib/authStorage";

export default function SignUp() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await signUp({
        full_name: fullName,
        email,
        password,
      });
      setCurrentUser(response.user);
      navigate("/home");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign up failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (currentUser) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div
      className="min-h-screen px-6 py-10 flex items-center justify-center
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(236,72,153,0.2),_transparent_60%)]"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl p-7 shadow-[0_18px_45px_rgba(15,23,42,0.85)]">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400 mb-2">
          AI Cademy Access
        </p>
        <h1 className="text-3xl font-semibold text-slate-50 tracking-tight mb-2">
          Sign Up
        </h1>
        <p className="text-sm text-slate-300 mb-6">
          Create your account to start using the platform.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-left text-sm text-slate-200">
            Full Name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
            />
          </label>

          <label className="text-left text-sm text-slate-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
            />
          </label>

          <label className="text-left text-sm text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
            />
          </label>

          {error && (
            <p className="text-sm text-rose-300 text-left">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 font-medium text-white disabled:opacity-70"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-slate-300 mt-5">
          Already have an account?{" "}
          <Link to="/signin" className="text-sky-300 hover:text-sky-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
