import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUsers } from "../lib/api";
import { getCurrentUser } from "../lib/authStorage";
import type { User } from "../types/auth";

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate("/signin");
      return;
    }

    async function loadUsers() {
      try {
        const data = await fetchUsers();
        setUsers(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load users.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [navigate]);

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(16,185,129,0.16),_transparent_60%)]"
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400 mb-2">
          User Management
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 tracking-tight mb-3">
          Registered Users
        </h1>
        <p className="text-sm text-slate-300 mb-8">
          This table is loaded from the Python backend and MongoDB users
          collection.
        </p>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl overflow-x-auto shadow-[0_18px_45px_rgba(15,23,42,0.85)]">
          {loading ? (
            <p className="p-6 text-slate-300">Loading users...</p>
          ) : error ? (
            <p className="p-6 text-rose-300">{error}</p>
          ) : (
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-slate-950/70">
                <tr>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                    ID
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                    Full Name
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-slate-800/80 hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {user.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {user.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(user.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
