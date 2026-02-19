export default function HomeworkAgentView() {
  return (
    <div
      className="rounded-2xl border border-slate-800/70 bg-slate-900/80
      backdrop-blur-xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-3"
    >
      <h2 className="text-sm font-semibold text-slate-100">
        Homework generator workspace
      </h2>
      <p className="text-xs text-slate-300">
        Here you will design prompts to generate practice questions,
        projects and homework sets tailored to your course topics.
        You can later plug in AI to propose tasks and difficulty levels.
      </p>
    </div>
  );
}
