"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { InstantLink } from "@/components/layout/instant-link";

const NOW_REFRESH_MS = 30_000;

/** Heure courante côté client uniquement (null au rendu serveur : pas d'écart d'hydratation). */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, NOW_REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  return now;
}

export function elapsedSince(iso: string | null, now: number | null, prefix: string): string | null {
  if (!iso || now === null) return null;
  const minutes = Math.max(Math.floor((now - new Date(iso).getTime()) / 60_000), 0);
  if (minutes < 1) return `${prefix} à l’instant`;
  if (minutes < 60) return `${prefix} il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${prefix} il y a ${hours} h${rest > 0 ? ` ${String(rest).padStart(2, "0")}` : ""}`;
}

/** Conteneur commun des pages du livreur. */
export function CourierPage({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pt-5">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900 sm:text-[24px]">{title}</h1>
            {description ? (
              <p className="mt-0.5 text-[12px] text-slate-500 sm:text-[13px]">{description}</p>
            ) : null}
          </div>
          {aside}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
        {description ? <p className="text-[12px] text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-[14px] font-semibold text-slate-800">{title}</p>
      <p className="max-w-sm text-[12px] text-slate-500">{text}</p>
    </div>
  );
}

type StatTone = "amber" | "sky" | "emerald" | "slate";

const STAT_TONES: Record<StatTone, string> = {
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  emerald: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-700",
};

export function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  href,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: StatTone;
  label: string;
  value: string;
  hint: string;
  /** Rend la carte cliquable vers la page détaillée. */
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${STAT_TONES[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[20px] font-bold leading-tight tabular-nums text-slate-900">{value}</p>
        <p className="truncate text-[11px] text-slate-500">{hint}</p>
      </div>
    </>
  );

  const className = "flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm";

  return href ? (
    <InstantLink
      href={href}
      className={`${className} transition active:bg-slate-50 sm:hover:border-emerald-200 sm:hover:bg-emerald-50/30`}
    >
      {content}
    </InstantLink>
  ) : (
    <div className={className}>{content}</div>
  );
}
