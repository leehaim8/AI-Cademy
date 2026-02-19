export default function CodeReviewAgentView() {
  return (
    <div
      className="rounded-2xl border border-slate-800/70 bg-slate-900/80
      backdrop-blur-xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col gap-3"
    >
      <h2 className="text-sm font-semibold text-slate-100">
        Pedagogical code review workspace
      </h2>
      <p className="text-xs text-slate-300">
        This page will focus on reviewing student code with an emphasis on
        clarity, learning goals and constructive feedback rather than only
        correctness.
      </p>
    </div>
  );
}
