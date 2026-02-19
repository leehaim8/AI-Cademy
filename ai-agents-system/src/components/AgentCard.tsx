import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface AgentCardProps {
  title: string;
  description: string;
  route: string;
  emoji: string;
}

export default function AgentCard({
  title,
  description,
  route,
  emoji,
}: AgentCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{ scale: 1.02, translateY: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "tween", duration: 0.12, ease: "easeOut" }}
      onClick={() => navigate(route)}
      className="
        relative cursor-pointer rounded-2xl p-6
        bg-slate-900/70 backdrop-blur-xl
        border border-slate-700/70
        shadow-[0_18px_45px_rgba(15,23,42,0.85)]
        hover:border-sky-400/80
        hover:shadow-[0_22px_60px_rgba(8,47,73,0.9)]
        transition-transform transition-shadow transition-colors
        duration-200
      "
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/0 via-sky-500/5 to-emerald-400/0 pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 border border-sky-500/40 text-lg">
            <span>{emoji}</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-50 tracking-tight">
            {title}
          </h2>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          {description}
        </p>

        <div className="mt-2 flex items-center text-xs font-medium text-sky-300">
          <span className="mr-1 h-[3px] w-10 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
          Open agent workspace
        </div>
      </div>
    </motion.div>
  );
}
