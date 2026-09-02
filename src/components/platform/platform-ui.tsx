import type {
  ButtonHTMLAttributes,
  ComponentType,
  ReactNode,
} from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function formatPlatformDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatPlatformDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatPlatformXof(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(amount)} F`;
}

export function PlatformPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#eef2f7_0%,#f4f6f9_28%,#f4f6f9_100%)]">
      {children}
    </div>
  );
}

export function PlatformPageHeader({
  title,
  description,
  meta,
  actions,
  filters,
  alert,
  embedded = false,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  alert?: ReactNode;
  /** Masque le titre — déjà affiché dans la topbar plateforme. */
  embedded?: boolean;
}) {
  const showTitleBlock = !embedded || description || meta;

  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-sm lg:px-6 lg:py-4">
      {alert}
      {showTitleBlock || actions ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          {showTitleBlock ? (
            <div className="min-w-0">
              {!embedded ? (
                <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p
                  className={`max-w-2xl text-[13px] leading-relaxed text-slate-500 ${
                    embedded ? "" : "mt-1"
                  }`}
                >
                  {description}
                </p>
              ) : null}
              {meta ? <div className={embedded ? "mt-2" : "mt-2"}>{meta}</div> : null}
            </div>
          ) : null}
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {filters ? <div className="mt-3 lg:mt-4">{filters}</div> : null}
    </div>
  );
}

export function PlatformAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info" | "warning";
  children: ReactNode;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  } as const;

  return (
    <div
      className={`mb-3 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${styles[tone]}`}
    >
      {children}
    </div>
  );
}

export function PlatformBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-h-0 flex-1 overflow-hidden px-4 py-4 lg:px-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function PlatformPanel({
  children,
  className = "",
  title,
  description,
  actions,
  icon: Icon,
  tone = "neutral",
  dense = false,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** Icône affichée dans un badge coloré avant le titre, pour un repérage plus rapide. */
  icon?: ComponentType<{ className?: string }>;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  dense?: boolean;
}) {
  const iconTones = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-sky-100 text-sky-700",
  } as const;

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {title ? (
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 ${
            dense ? "px-3 py-2" : "px-4 py-3.5 lg:px-5"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <span
                className={`inline-flex shrink-0 items-center justify-center rounded-lg ${iconTones[tone]} ${
                  dense ? "h-6 w-6" : "h-7 w-7"
                }`}
                aria-hidden
              >
                <Icon className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} />
              </span>
            ) : null}
            <h3
              className={`min-w-0 truncate font-semibold text-slate-900 ${
                dense ? "text-[12px]" : "text-[13px]"
              }`}
            >
              {title}
              {description ? (
                <span className="ml-2 font-normal text-slate-400">
                  · {description}
                </span>
              ) : null}
            </h3>
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PlatformKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "from-slate-50 to-white text-slate-700",
    success: "from-emerald-50 to-white text-emerald-700",
    warning: "from-amber-50 to-white text-amber-700",
    danger: "from-rose-50 to-white text-rose-700",
    info: "from-sky-50 to-white text-sky-700",
  } as const;

  const iconTones = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-sky-100 text-sky-700",
  } as const;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-gradient-to-b ${tones[tone]} px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </p>
        {Icon ? (
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${iconTones[tone]}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function PlatformSearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`relative block min-w-[200px] flex-1 sm:max-w-xs ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

export function PlatformSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${className}`}
    >
      {children}
    </select>
  );
}

export function PlatformFilters({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

export function PlatformEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 h-10 w-10 rounded-full border border-dashed border-slate-300 bg-slate-50" />
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function PlatformTableScroll({ children }: { children: ReactNode }) {
  return <div className="app-scroll min-h-0 flex-1 overflow-auto">{children}</div>;
}

export const PLATFORM_TABLE_HEAD =
  "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-[11px] uppercase tracking-[0.06em] text-slate-500 backdrop-blur";

export const PLATFORM_TH = "px-4 py-3 font-semibold first:pl-5 last:pr-5";
export const PLATFORM_TD = "px-4 py-3.5 first:pl-5 last:pr-5";
export const PLATFORM_TR =
  "border-b border-slate-100 transition last:border-0 hover:bg-slate-50/80";

export function PlatformButton({
  children,
  tone = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger" | "ghost" | "success";
}) {
  const tones = {
    primary:
      "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-600 active:bg-emerald-800 disabled:bg-emerald-300",
    secondary:
      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50",
    danger:
      "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 active:bg-red-200 disabled:opacity-50",
    ghost:
      "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200 disabled:opacity-50",
  } as const;

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Purely informational meta pill (never clickable) — a thin wrapper over the shared Badge. */
export function PlatformMetaChip({ children }: { children: ReactNode }) {
  return <Badge tone="neutral">{children}</Badge>;
}
