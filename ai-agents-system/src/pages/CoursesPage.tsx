import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../lib/authStorage";
import { createCourse, listCourses, updateCourse } from "../lib/courseStore";
import type { Course } from "../types/course";

export default function CoursesPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [courses, setCourses] = useState<Course[]>(
    currentUser ? listCourses(currentUser.id) : [],
  );
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

  const firstName = useMemo(
    () => currentUser?.full_name?.split(" ")[0] ?? "",
    [currentUser?.full_name],
  );
  const headline = firstName ? `My courses, ${firstName}` : "My courses";

  function handleCreateCourse() {
    if (!currentUser) return;
    if (!name.trim()) {
      setError("Course name is required.");
      return;
    }
    const course = createCourse({
      name,
      code,
      term,
      owner_user_id: currentUser.id,
    });
    setCourses((prev) => [course, ...prev]);
    setName("");
    setCode("");
    setTerm("");
    setError("");
    setShowForm(false);
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

  function handleSaveEdit(courseId: string) {
    if (!editName.trim()) {
      setEditError("Course name is required.");
      return;
    }

    const updated = updateCourse(courseId, {
      name: editName,
      code: editCode,
      term: editTerm,
    });

    if (!updated) {
      setEditError("Could not update this course.");
      return;
    }

    setCourses((prev) =>
      prev.map((course) => (course.id === courseId ? updated : course)),
    );
    handleCancelEdit();
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
        <p className="max-w-2xl text-sm text-slate-300">
          Courses are the starting point for your agent workspaces
        </p>
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
        {courses.length === 0 ? (
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
                  <h2 className="text-lg font-semibold text-slate-50">
                    {course.name}
                  </h2>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-slate-400">
                    {course.code ? <span>Code: {course.code}</span> : null}
                    {course.term ? <span>Term: {course.term}</span> : null}
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
                  <button
                    type="button"
                    onClick={() => handleStartEdit(course)}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Edit
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
