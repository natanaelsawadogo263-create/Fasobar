"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

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
  const weekday = now.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  const day = now.toLocaleDateString("fr-FR", { day: "numeric" });
  const month = now.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  const date = `${capitalize(weekday)} ${day} ${capitalize(month)}`;
  return { time, date };
}

function capitalize(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function clockClassName(className: string, fallback: string) {
  const hasDisplay =
    className.includes("inline-flex") ||
    className.includes("flex") ||
    className.includes("hidden");
  return `${hasDisplay ? "" : fallback} ${className}`.trim();
}

export function LiveClock({
  variant = "light",
  showDate = true,
  inline = false,
  className = "",
}: LiveClockProps) {
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
        className={clockClassName(
          className,
          `inline-flex items-center gap-2 text-[12px] tabular-nums ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`,
        )}
        title="Heure locale"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isDark ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <Clock3 className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        {showDate ? (
          <span className={isDark ? "text-slate-400" : "text-slate-500"}>
            {formatted?.date ?? "\u00a0"}
          </span>
        ) : null}
        {showDate ? (
          <span className={isDark ? "text-white/20" : "text-slate-200"} aria-hidden>
            ·
          </span>
        ) : null}
        <span
          className={`font-semibold tabular-nums tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {formatted?.time ?? "--:--:--"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={clockClassName(
        className,
        `inline-flex items-center gap-2 rounded-2xl px-2 py-1 ${
          isDark
            ? "border border-white/10 bg-white/[0.06] shadow-none"
            : "border border-emerald-100/80 bg-gradient-to-r from-emerald-50/80 to-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        }`,
      )}
      title="Heure locale"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isDark
            ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20"
            : "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
        }`}
      >
        <Clock3 className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-[5.75rem] leading-none">
        {showDate ? (
          <p
            className={`text-[10px] font-medium ${
              isDark ? "text-slate-400" : "text-emerald-800/70"
            }`}
          >
            {formatted?.date ?? "\u00a0"}
          </p>
        ) : null}
        <p
          className={`mt-0.5 text-[13px] font-semibold tabular-nums tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {formatted?.time ?? "--:--:--"}
        </p>
      </div>
    </div>
  );
}
