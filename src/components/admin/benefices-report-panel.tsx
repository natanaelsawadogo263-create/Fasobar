"use client";

import { TrendingDown, TrendingUp, Wine, UtensilsCrossed } from "lucide-react";

import { formatReportCell } from "@/lib/reports/constants";
import type { ReportResult } from "@/lib/reports/types";
import {
  hasBarService,
  hasKitchenService,
  isSingleServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type SpaceBreakdown = {
  space: string;
  revenue: number;
  supplyCost: number;
  expenses: number;
  profit: number;
};

function readSpace(rows: ReportResult["rows"], space: string): SpaceBreakdown | null {
  const row = rows.find((item) => item.space === space);
  if (!row) return null;
  return {
    space,
    revenue: Number(row.revenue ?? 0),
    supplyCost: Number(row.supplyCost ?? 0),
    expenses: Number(row.expenses ?? 0),
    profit: Number(row.profit ?? 0),
  };
}

function moneyClass(amount: number, emphasize = false): string {
  if (amount < 0) {
    return emphasize ? "text-red-700" : "text-red-600";
  }
  if (amount > 0) {
    return emphasize ? "text-emerald-700" : "text-emerald-700";
  }
  return emphasize ? "text-slate-900" : "text-slate-700";
}

function SpaceCard({
  data,
  icon: Icon,
  accent,
}: {
  data: SpaceBreakdown;
  icon: React.ComponentType<{ className?: string }>;
  accent: "bar" | "kitchen";
}) {
  const shell =
    accent === "bar"
      ? "border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white"
      : "border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white";
  const badge =
    accent === "bar"
      ? "bg-sky-100 text-sky-800"
      : "bg-amber-100 text-amber-900";

  return (
    <article className={`flex flex-col rounded-xl border p-4 shadow-sm print:break-inside-avoid ${shell}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${badge}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">{data.space}</h3>
            <p className="text-[11px] text-slate-500">CA − Appro − Dépenses</p>
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-3 text-[12px]">
          <dt className="text-slate-500">Chiffre d&apos;affaires</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {formatReportCell(data.revenue, "currency")}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-[12px]">
          <dt className="text-slate-500">Approvisionnements</dt>
          <dd className="font-semibold tabular-nums text-slate-700">
            − {formatReportCell(data.supplyCost, "currency")}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2.5 text-[12px]">
          <dt className="text-slate-500">Dépenses</dt>
          <dd className="font-semibold tabular-nums text-slate-700">
            − {formatReportCell(data.expenses, "currency")}
          </dd>
        </div>
        <div className="flex items-end justify-between gap-3 pt-1">
          <dt className="text-[12px] font-semibold text-slate-800">Bénéfice net</dt>
          <dd
            className={`text-[18px] font-bold tabular-nums tracking-tight ${moneyClass(data.profit, true)}`}
          >
            {formatReportCell(data.profit, "currency")}
          </dd>
        </div>
      </dl>
    </article>
  );
}

type BeneficesReportPanelProps = {
  report: ReportResult;
  serviceScope?: ServiceScope;
};

export function BeneficesReportPanel({
  report,
  serviceScope = "BOTH",
}: BeneficesReportPanelProps) {
  const showBar = hasBarService(serviceScope);
  const showKitchen = hasKitchenService(serviceScope);
  const singleScope = isSingleServiceScope(serviceScope);

  const bar = showBar ? readSpace(report.rows, "Bar") : null;
  const kitchen = showKitchen ? readSpace(report.rows, "Cuisine") : null;
  const total = readSpace(report.rows, "Total");

  if (!total) {
    return null;
  }
  if (showBar && !bar) return null;
  if (showKitchen && !kitchen) return null;

  const ProfitIcon = total.profit >= 0 ? TrendingUp : TrendingDown;
  const heroTone =
    total.profit >= 0
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
      : "border-red-200 bg-gradient-to-br from-red-50 to-white";
  const heroIconTone =
    total.profit >= 0
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700";

  const spaceRows = singleScope
    ? [total]
    : [bar, kitchen, total].filter((row): row is SpaceBreakdown => Boolean(row));

  return (
    <div className="app-scroll h-full space-y-4 overflow-auto p-4 sm:p-5 print:h-auto print:overflow-visible">
      <section className={`rounded-xl border p-4 shadow-sm sm:p-5 print:break-inside-avoid ${heroTone}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${heroIconTone}`}
            >
              <ProfitIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Bénéfice net total
              </p>
              <p
                className={`mt-1 text-[28px] font-bold tabular-nums tracking-tight sm:text-[32px] ${moneyClass(total.profit, true)}`}
              >
                {formatReportCell(total.profit, "currency")}
              </p>
              {singleScope ? null : (
                <p className="mt-1 text-[12px] text-slate-500">
                  {bar ? (
                    <>
                      Bar {formatReportCell(bar.profit, "currency")}
                    </>
                  ) : null}
                  {bar && kitchen ? (
                    <span className="mx-1.5 text-slate-300">·</span>
                  ) : null}
                  {kitchen ? (
                    <>
                      Cuisine {formatReportCell(kitchen.profit, "currency")}
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                CA
              </p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums text-slate-900">
                {formatReportCell(total.revenue, "currency")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Appro
              </p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums text-slate-800">
                {formatReportCell(total.supplyCost, "currency")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Dépenses
              </p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums text-slate-800">
                {formatReportCell(total.expenses, "currency")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {singleScope ? null : (
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {bar ? <SpaceCard data={bar} icon={Wine} accent="bar" /> : null}
          {kitchen ? (
            <SpaceCard data={kitchen} icon={UtensilsCrossed} accent="kitchen" />
          ) : null}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-[13px] font-semibold text-slate-900">
            {singleScope ? "Synthèse" : "Synthèse comparative"}
          </h3>
          <p className="text-[11px] text-slate-500">
            Tous les postes visibles : CA, approvisionnements, dépenses, bénéfice.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Espace</th>
                <th className="px-4 py-2.5 text-right font-medium">CA</th>
                <th className="px-4 py-2.5 text-right font-medium">Approvisionnements</th>
                <th className="px-4 py-2.5 text-right font-medium">Dépenses</th>
                <th className="px-4 py-2.5 text-right font-medium">Bénéfice net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {spaceRows.map((row) => {
                const isTotal = row.space === "Total";
                return (
                  <tr
                    key={row.space}
                    className={
                      isTotal
                        ? "bg-slate-50/80 font-semibold print:break-inside-avoid"
                        : "hover:bg-slate-50/60 print:break-inside-avoid"
                    }
                  >
                    <td className="px-4 py-3 text-slate-900">
                      {singleScope && isTotal
                        ? serviceScope === "BAR"
                          ? "Boissons"
                          : "Nourriture"
                        : row.space}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {formatReportCell(row.revenue, "currency")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatReportCell(row.supplyCost, "currency")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatReportCell(row.expenses, "currency")}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${moneyClass(row.profit, isTotal)}`}
                    >
                      {formatReportCell(row.profit, "currency")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Formule : bénéfice = ventes payées − approvisionnements stock − dépenses
        {singleScope
          ? "."
          : " de l'espace (Bar ou Caisse/Cuisine)."}
      </p>
    </div>
  );
}
