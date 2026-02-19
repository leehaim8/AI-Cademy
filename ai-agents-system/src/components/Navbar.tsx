import logo from "../assets/ai-cademy-logo.svg";

export default function Navbar() {
  return (
    <nav
      className="w-full px-8 py-4 flex items-center justify-between
      bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60
      sticky top-0 z-50"
    >
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={logo}
          alt="AI Cademy logo"
          className="h-9 w-9 drop-shadow-[0_0_18px_rgba(56,189,248,0.8)]"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold tracking-wide text-slate-50">
            AI CADEMY
          </span>
          <span className="text-[11px] text-slate-400 leading-tight break-words">
            AI CADEMY – Teaching Agents Platform
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          <span className="uppercase tracking-[0.18em] text-emerald-300">
            Live workspace
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-xs">
            <span className="text-slate-200 font-medium">Lee Haim</span>
            <span className="text-slate-500">Instructor</span>
          </div>
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-tr
            from-indigo-500 via-fuchsia-500 to-sky-400 flex items-center
            justify-center text-white font-semibold text-sm shadow-[0_0_18px_rgba(129,140,248,0.8)]"
          >
            LH
          </div>
        </div>
      </div>
    </nav>
  );
}
