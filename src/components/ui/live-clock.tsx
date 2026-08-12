"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

type LiveClockProps = {
  /** Affichage sombre (caisse FasoBar) ou clair (admin / bar / platform). */
  variant?: "light" | "dark";
  /** Afficher aussi la date du jour. */
  showDate?: boolean;
  /** Une seule ligne compacte (idéal pour topbar dense). */
  inline?: boolean;
  className?: string;
};

function formatNow(now: Date) {
  const time = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return { time, date };
}

export function LiveClock({
  variant = "light",
  showDate = true,
  inline = false,
  className = "",
}: LiveClockProps) {
  // null jusqu'au montage : évite le mismatch SSR/client (seconde qui change).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const formatted = now ? formatNow(now) : null;
  const isDark = variant === "dark";

  if (inline) {
    return (
      <div
        className={`items-center gap-1.5 text-[11px] tabular-nums ${
          isDark ? "text-slate-300" : "text-slate-600"
        } ${className.includes("inline-flex") || className.includes("flex") || className.includes("hidden") ? "" : "inline-flex"} ${className}`}
        title="Heure locale"
        aria-live="polite"
        aria-atomic="true"
      >
        <Clock
          className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
          strokeWidth={2}
        />
        {showDate ? (
          <span className={isDark ? "text-slate-400" : "text-slate-500"}>
            {formatted?.date ?? "\u00a0"}
          </span>
        ) : null}
        {showDate ? <span className={isDark ? "text-white/20" : "text-slate-300"}>·</span> : null}
        <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          {formatted?.time ?? "--:--:--"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
        isDark
          ? "border-white/10 bg-white/[0.04] text-slate-200"
          : "border-slate-200 bg-white text-slate-700"
      } ${className.includes("inline-flex") || className.includes("flex") || className.includes("hidden") ? "" : "inline-flex"} ${className}`}
      title="Heure locale"
      aria-live="polite"
      aria-atomic="true"
    >
      <Clock
        className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
        strokeWidth={2}
      />
      <div className="leading-tight">
        {showDate ? (
          <p
            className={`text-[10px] font-medium uppercase tracking-wide ${
              isDark ? "text-slate-400" : "text-slate-400"
            }`}
          >
            {formatted?.date ?? "\u00a0"}
          </p>
        ) : null}
        <p
          className={`pos-tabular text-[12px] font-semibold tabular-nums ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {formatted?.time ?? "--:--:--"}
        </p>
      </div>
    </div>
  );
}
