import type { ReactNode } from "react";

type AgentActionButtonProps = {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  type?: "button" | "submit";
  variant?: "sky" | "emerald" | "violet" | "rose";
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
};

const variantClasses: Record<NonNullable<AgentActionButtonProps["variant"]>, string> = {
  sky: "border-sky-500/50 bg-sky-500/10 text-sky-200 hover:border-sky-400 hover:bg-sky-500/15 hover:text-sky-100",
  emerald: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-100",
  violet: "border-violet-500/50 bg-violet-500/10 text-violet-200 hover:border-violet-400 hover:bg-violet-500/15 hover:text-violet-100",
  rose: "border-rose-500/50 bg-rose-500/10 text-rose-200 hover:border-rose-400 hover:bg-rose-500/15 hover:text-rose-100",
};

export default function AgentActionButton({
  children,
  onClick,
  type = "button",
  variant = "sky",
  disabled = false,
  fullWidth = false,
  className = "",
}: AgentActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors",
        fullWidth ? "w-full sm:w-auto" : "",
        variantClasses[variant],
        "disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{children}</span>
    </button>
  );
}
