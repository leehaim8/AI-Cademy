export default function SyllabusAgentView() {
  return (
    <div
      className="rounded-2xl border border-slate-800/70 bg-slate-900/80
      backdrop-blur-xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-3"
    >
      <h2 className="text-sm font-semibold text-slate-100">
        Syllabus workspace
      </h2>
      <p className="text-xs text-slate-300">
        This page will help you structure a full course: modules, lessons,
        learning outcomes and assessments. For now it is a visual skeleton
        you can extend with forms, drag-and-drop modules or AI suggestions.
      </p>
    </div>
  );
}
