import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/ai-cademy-logo.svg";
import { clearCurrentUser, getCurrentUser } from "../lib/authStorage";

export default function Navbar() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = currentUser?.full_name ?? "Guest User";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, []);

  function handleLogout() {
    clearCurrentUser();
    setMenuOpen(false);
    navigate("/signin");
  }

  function handleSettings() {
    setMenuOpen(false);
    navigate("/settings");
  }

  return (
    <nav
      className="w-full px-8 py-4 flex items-center justify-between
      bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60
      sticky top-0 z-50"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Link to="/home" className="flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity">
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
        </Link>
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
            <span className="text-slate-200 font-medium">{displayName}</span>
            <span className="text-slate-500">
              {currentUser ? "Signed in" : "Not signed in"}
            </span>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-gradient-to-tr
              from-indigo-500 via-fuchsia-500 to-sky-400 flex items-center
              justify-center text-white font-semibold text-sm shadow-[0_0_18px_rgba(129,140,248,0.8)]
              hover:brightness-110 transition"
              aria-label="Open profile menu"
            >
              {initials || "GU"}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/80"
                  onClick={handleSettings}
                >
                  Settings
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-800/80"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
