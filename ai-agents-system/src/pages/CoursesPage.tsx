import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../lib/authStorage";
import { createDisabledAgentsConfig, setEnabledAgents } from "../lib/courseStore";
import {
  createBackendCourse,
  deleteBackendCourse,
  fetchCourses,
  updateBackendCourse,
} from "../lib/api";
import type { Course } from "../types/course";

export default function CoursesPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id ?? "";
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(currentUser));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [term, setTerm] = useState("");
  const [error, setError] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editTerm, setEditTerm] = useState("");
  const [editError, setEditError] = useState("");
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  const firstName = useMemo(
    () => currentUser?.full_name?.split(" ")[0] ?? "",
    [currentUser?.full_name],
  );
  const headline = firstName ? `My courses, ${firstName}` : "My courses";

  useEffect(() => {
    if (!currentUserId) {
      setCourses([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadCourses = async () => {
      setIsLoading(true);
      setError("");

      try {
        const nextCourses = await fetchCourses(currentUserId);
        if (!cancelled) {
          setCourses(nextCourses);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load courses.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCourses();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  async function handleCreateCourse() {
    if (!currentUser) return;
    if (!name.trim()) {
      setError("Course name is required.");
      return;
    }

    try {
      const course = await createBackendCourse({
        name,
        code,
        term,
        owner_user_id: currentUser.id,
      });
      setEnabledAgents(course.id, createDisabledAgentsConfig());
      setCourses((prev) => [course, ...prev]);
      setName("");
      setCode("");
      setTerm("");
      setError("");
      setShowForm(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create this course.",
      );
    }
  }

  function handleOpenCourse(courseId: string) {
    const target = `/courses/${encodeURIComponent(courseId)}/agents`;
    navigate(target);
  }

  function handleStartEdit(course: Course) {
    setEditingCourseId(course.id);
    setEditName(course.name);
    setEditCode(course.code ?? "");
    setEditTerm(course.term ?? "");
    setEditError("");
  }

  function handleCancelEdit() {
    setEditingCourseId(null);
    setEditName("");
    setEditCode("");
    setEditTerm("");
    setEditError("");
  }

  async function handleSaveEdit(courseId: string) {
    if (!editName.trim()) {
      setEditError("Course name is required.");
      return;
    }

    try {
      const updated = await updateBackendCourse(courseId, {
        name: editName,
        code: editCode,
        term: editTerm,
      });

      setCourses((prev) =>
        prev.map((course) => (course.id === courseId ? updated : course)),
      );
      handleCancelEdit();
    } catch (updateError) {
      setEditError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update this course.",
      );
    }
  }

  async function handleDeleteCourse(course: Course) {
    const shouldDelete = window.confirm(
      `Delete "${course.name}"? This will also remove its sessions and saved agent data.`,
    );
    if (!shouldDelete) {
      return;
    }

    setDeletingCourseId(course.id);
    setError("");

    try {
      await deleteBackendCourse(course.id);
      setCourses((prev) => prev.filter((entry) => entry.id !== course.id));
      if (editingCourseId === course.id) {
        handleCancelEdit();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this course.",
      );
    } finally {
      setDeletingCourseId((current) => (current === course.id ? null : current));
    }
  }

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(129,140,248,0.26),_transparent_60%)]"
    >
      <header className="mb-10 flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400">
          AI CADEMY platform
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 tracking-tight">
          {headline}
        </h1>
      </header>

      <div className="mb-8 rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
          >
            {showForm ? "Close" : "Add Course"}
          </button>
        </div>

        {showForm ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
              Name *
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Operating Systems"
                className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
              Code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="CS-320"
                className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
              Term
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Fall 2026"
                className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
              />
            </label>
            <div className="md:col-span-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreateCourse}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white"
              >
                Create course
              </button>
              {error ? <span className="text-xs text-rose-300">{error}</span> : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-6 text-slate-200">
            <h2 className="text-lg font-semibold">Loading courses...</h2>
            <p className="mt-2 text-sm text-slate-300">
              Fetching your saved courses from the database.
            </p>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-6 text-slate-200">
            <h2 className="text-lg font-semibold">No courses yet</h2>
            <p className="mt-2 text-sm text-slate-300">
              Create your first course to start using the agents
            </p>
          </div>
        ) : (
          courses.map((course) => (
            <div
              key={course.id}
              className="flex min-h-[220px] flex-col rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)]"
            >
              {editingCourseId === course.id ? (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    Name *
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    Code
                    <input
                      value={editCode}
                      onChange={(event) => setEditCode(event.target.value)}
                      className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    Term
                    <input
                      value={editTerm}
                      onChange={(event) => setEditTerm(event.target.value)}
                      className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                    />
                  </label>
                  {editError ? (
                    <p className="text-xs text-rose-300">{editError}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-50">
                      {course.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(course)}
                        aria-label={`Edit ${course.name}`}
                        title={`Edit ${course.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-200 hover:border-slate-500"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(course)}
                        aria-label={`Delete ${course.name}`}
                        title={`Delete ${course.name}`}
                        disabled={deletingCourseId === course.id}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/40 text-rose-200 transition disabled:cursor-not-allowed disabled:opacity-60 hover:border-rose-400"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="flex-1" />
              {editingCourseId === course.id ? (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(course.id)}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCourse(course.id)}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Open course dashboard
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
