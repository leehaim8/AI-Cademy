import { useParams } from "react-router-dom";

export default function AgentPage() {
  const { id } = useParams();

  return (
    <div
      className="min-h-screen px-6 py-10
      bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_55%),
      radial-gradient(circle_at_bottom,_rgba(236,72,153,0.22),_transparent_60%)]"
    >
      <div className="max-w-4xl mx-auto">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-sky-400 mb-3">
          Agent workspace
        </p>

        <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 mb-3 tracking-tight">
          {id} agent
        </h1>

        <p className="text-sm text-slate-300 mb-8 max-w-2xl">
          This is where the interactive tools, prompts and visualizations
          for this AI teaching agent will live. You can plug in course
          materials, student work or learning goals and let the agent assist
          you.
        </p>

        <div
          className="rounded-2xl border border-slate-800/70 bg-slate-900/70
          backdrop-blur-xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] text-slate-200"
        >
          <p className="text-sm text-slate-300">
            Agent UI placeholder – here we can later add chat, upload
            panels, configuration sliders and more.
          </p>
        </div>
      </div>
    </div>
  );
}
