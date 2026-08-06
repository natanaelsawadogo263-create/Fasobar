"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ClipboardList,
  Download,
  Landmark,
  Package,
  Printer,
  ShoppingBag,
  TrendingUp,
  Truck,
  UtensilsCrossed,
  Wallet,
  Wine,
} from "lucide-react";

import { getReportDataAction } from "@/app/(protected)/application/rapports/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { downloadCsv } from "@/lib/csv/download-csv";
import { formatReportCell, REPORT_TYPE_OPTIONS } from "@/lib/reports/constants";
import type { ReportFiltersInput, ReportType } from "@/lib/reports/schemas";
import type { ReportResult } from "@/lib/reports/types";

type AdminReportsWorkspaceProps = {
  initialReport: ReportResult;
  initialFilters: ReportFiltersInput;
  establishmentName: string;
};

const REPORT_ICONS: Partial<
  Record<ReportType, React.ComponentType<{ className?: string }>>
> = {
  ventes: ShoppingBag,
  produits_vendus: Package,
  stock_boissons: Wine,
  approvisionnements: Truck,
  pertes_casse: AlertTriangle,
  depenses_cuisine: UtensilsCrossed,
  sessions_caisse: Landmark,
  ecarts_caisse: Wallet,
  activite_utilisateurs: Activity,
};

const REPORT_GROUPS: Array<{ label: string; types: ReportType[] }> = [
  { label: "Commercial", types: ["ventes", "produits_vendus"] },
  {
    label: "Stock & achats",
    types: ["stock_boissons", "approvisionnements", "pertes_casse"],
  },
  { label: "Caisse", types: ["sessions_caisse", "ecarts_caisse"] },
  {
    label: "Administration",
    types: ["depenses_cuisine", "activite_utilisateurs"],
  },
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function periodPresets(): Array<{ id: string; label: string; from?: string; to?: string }> {
  const today = new Date();
  const end = toIsoDate(today);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 6);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const start30 = new Date(today);
  start30.setDate(today.getDate() - 29);

  return [
    { id: "today", label: "Aujourd'hui", from: end, to: end },
    { id: "7d", label: "7 jours", from: toIsoDate(startOfWeek), to: end },
    { id: "30d", label: "30 jours", from: toIsoDate(start30), to: end },
    { id: "month", label: "Ce mois", from: toIsoDate(startOfMonth), to: end },
    { id: "all", label: "Tout", from: undefined, to: undefined },
  ];
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function summaryTone(
  label: string,
  index: number,
): {
  card: string;
  icon: string;
  iconKey: "trend" | "basket" | "orders" | "chart";
} {
  const normalized = label.toLowerCase();

  if (
    normalized.includes("chiffre") ||
    normalized.includes("montant") ||
    normalized.includes("valeur") ||
    normalized.includes("total")
  ) {
    return {
      card: "border-emerald-100 bg-emerald-50/50",
      icon: "bg-emerald-100 text-emerald-700",
      iconKey: "trend",
    };
  }

  if (
    normalized.includes("panier") ||
    normalized.includes("moyen") ||
    normalized.includes("moyenne")
  ) {
    return {
      card: "border-amber-100 bg-amber-50/40",
      icon: "bg-amber-100 text-amber-700",
      iconKey: "basket",
    };
  }

  if (
    normalized.includes("commande") ||
    normalized.includes("session") ||
    normalized.includes("ligne") ||
    normalized.includes("article") ||
    normalized.includes("produit")
  ) {
    return {
      card: "border-sky-100 bg-sky-50/40",
      icon: "bg-sky-100 text-sky-700",
      iconKey: "orders",
    };
  }

  const fallbackKeys = ["chart", "trend", "orders"] as const;
  const tones = [
    {
      card: "border-slate-200/90 bg-white",
      icon: "bg-slate-100 text-slate-600",
    },
    {
      card: "border-emerald-100 bg-emerald-50/40",
      icon: "bg-emerald-100 text-emerald-700",
    },
    {
      card: "border-sky-100 bg-sky-50/40",
      icon: "bg-sky-100 text-sky-700",
    },
  ] as const;

  const tone = tones[index % 3]!;
  return { ...tone, iconKey: fallbackKeys[index % 3]! };
}

const SUMMARY_ICONS = {
  trend: TrendingUp,
  basket: ShoppingBag,
  orders: ClipboardList,
  chart: BarChart3,
} as const;

export function AdminReportsWorkspace({
  initialReport,
  initialFilters,
  establishmentName,
}: AdminReportsWorkspaceProps) {
  const [report, setReport] = useState<ReportResult>(initialReport);
  const [filters, setFilters] = useState<ReportFiltersInput>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const presets = useMemo(() => periodPresets(), []);

  const optionsById = useMemo(
    () => new Map(REPORT_TYPE_OPTIONS.map((option) => [option.id, option])),
    [],
  );

  const activeOption = optionsById.get(report.type);

  const periodLabel = useMemo(() => {
    if (filters.from && filters.to) {
      return `${formatShortDate(filters.from)} → ${formatShortDate(filters.to)}`;
    }
    if (filters.from) return `Depuis ${formatShortDate(filters.from)}`;
    if (filters.to) return `Jusqu’au ${formatShortDate(filters.to)}`;
    return "Toute la période";
  }, [filters.from, filters.to]);

  const activePresetId = useMemo(() => {
    const match = presets.find(
      (preset) =>
        (preset.from ?? "") === (filters.from ?? "") &&
        (preset.to ?? "") === (filters.to ?? ""),
    );
    return match?.id ?? "custom";
  }, [filters.from, filters.to, presets]);

  function loadReport(type: ReportType, nextFilters: ReportFiltersInput) {
    setError(null);
    startTransition(async () => {
      const result = await getReportDataAction(type, nextFilters);
      if (result.error || !result.data) {
        setError(result.error ?? "Impossible de charger ce rapport.");
        return;
      }
      setReport(result.data);
    });
  }

  function handleSelectType(type: ReportType) {
    if (type === report.type && !isPending) return;
    loadReport(type, filters);
  }

  function handleFilterChange(next: Partial<ReportFiltersInput>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    loadReport(report.type, merged);
  }

  function applyPreset(from?: string, to?: string) {
    const next = { from, to };
    setFilters(next);
    loadReport(report.type, next);
  }

  function exportCsv() {
    const filenameSuffix = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `rapport-${report.type}-${filenameSuffix}.csv`,
      report.columns.map((column) => column.label),
      report.rows.map((row) => report.columns.map((column) => row[column.key])),
    );
  }

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-4 py-3 lg:gap-3.5 lg:px-5 lg:py-4">
      <header className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Rapports
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            <span className="font-medium text-slate-700">{establishmentName}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              {periodLabel}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.from, preset.to)}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  activePresetId === preset.id
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              Du
              <input
                type="date"
                value={filters.from ?? ""}
                onChange={(event) =>
                  handleFilterChange({ from: event.target.value || undefined })
                }
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-800 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              Au
              <input
                type="date"
                value={filters.to ?? ""}
                onChange={(event) =>
                  handleFilterChange({ to: event.target.value || undefined })
                }
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-800 outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            disabled={report.rows.length === 0 || isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </button>
        </div>
      </header>

      {error ? (
        <div className="shrink-0 print:hidden">
          <AlertMessage message={error} />
        </div>
      ) : null}

      <div className="grid min-h-0 gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-3.5 print:grid-cols-1">
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm print:hidden lg:flex">
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="text-[12px] font-semibold text-slate-900">Catalogue</p>
            <p className="text-[11px] text-slate-500">Choisissez un rapport</p>
          </div>
          <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {REPORT_GROUPS.map((group) => {
              const items = group.types
                .map((type) => optionsById.get(type))
                .filter((option): option is NonNullable<typeof option> => Boolean(option));
              if (items.length === 0) return null;

              return (
                <div key={group.label} className="mb-3 last:mb-0">
                  <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((option) => {
                      const Icon = REPORT_ICONS[option.id] ?? BarChart3;
                      const active = report.type === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleSelectType(option.id)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                            active
                              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <span
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate text-[12px] font-semibold">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="shrink-0 border-b border-slate-100 px-3.5 py-2.5 print:hidden lg:hidden">
            <select
              value={report.type}
              onChange={(event) =>
                handleSelectType(event.target.value as ReportType)
              }
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800"
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = REPORT_ICONS[report.type] ?? BarChart3;
                    return (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    );
                  })()}
                  <div className="min-w-0">
                    <h2 className="text-[14px] font-semibold tracking-tight text-slate-900">
                      {report.title}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {activeOption?.description ?? report.description}
                    </p>
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
                {report.rows.length} résultat{report.rows.length > 1 ? "s" : ""}
              </span>
            </div>

            {report.summary.length > 0 ? (
              <div
                className={`mt-2.5 grid gap-2 ${
                  report.summary.length === 1
                    ? "grid-cols-1 sm:max-w-xs"
                    : report.summary.length === 2
                      ? "grid-cols-2"
                      : report.summary.length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2 xl:grid-cols-4"
                }`}
              >
                {report.summary.map((item, index) => {
                  const tone = summaryTone(item.label, index);
                  const SummaryIcon = SUMMARY_ICONS[tone.iconKey];
                  return (
                    <article
                      key={item.label}
                      className={`rounded-lg border px-2.5 py-2 ${tone.card}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone.icon}`}
                        >
                          <SummaryIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-medium text-slate-500">
                            {item.label}
                          </p>
                          <p className="truncate text-[13px] font-bold tabular-nums text-slate-900">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative min-h-0 flex-1">
            {isPending ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-medium text-slate-600 shadow-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Chargement…
                </div>
              </div>
            ) : null}

            {report.rows.length === 0 && !isPending ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-200">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">
                  Aucune donnée sur cette période
                </h3>
                <p className="mt-1.5 max-w-sm text-[12px] text-slate-500">
                  Changez les dates ou sélectionnez un autre rapport. Seules les
                  données réelles de l&apos;établissement apparaissent ici.
                </p>
              </div>
            ) : (
              <div className="app-scroll h-full overflow-auto">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
                    <tr>
                      {report.columns.map((column) => (
                        <th
                          key={column.key}
                          className={`px-3.5 py-2.5 font-medium ${
                            column.format === "currency" || column.format === "number"
                              ? "text-right"
                              : ""
                          }`}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.rows.map((row, index) => (
                      <tr
                        key={index}
                        className="text-slate-700 hover:bg-slate-50/70"
                      >
                        {report.columns.map((column, columnIndex) => {
                          const isNumeric =
                            column.format === "currency" || column.format === "number";
                          const isMoney = column.format === "currency";
                          return (
                            <td
                              key={column.key}
                              className={`px-3.5 py-2.5 ${
                                isNumeric ? "text-right tabular-nums" : ""
                              } ${
                                columnIndex === 0 || isMoney
                                  ? "font-semibold text-slate-900"
                                  : ""
                              }`}
                            >
                              {formatReportCell(row[column.key], column.format)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
