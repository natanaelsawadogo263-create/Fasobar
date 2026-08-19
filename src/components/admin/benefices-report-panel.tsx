"use client";

import { TrendingDown, TrendingUp, Wine, UtensilsCrossed } from "lucide-react";

import { getActivityPages } from "@/lib/activity/pages";
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
  profit: number | null;
};

function readSpace(rows: ReportResult["rows"], space: string): SpaceBreakdown | null {
  const row = rows.find((item) => item.space === space);
  if (!row) return null;
  const profitRaw = row.profit;
  return {
    space,
    revenue: Number(row.revenue ?? 0),
    supplyCost: Number(row.supplyCost ?? 0),
    expenses: Number(row.expenses ?? 0),
    profit: profitRaw === null || profitRaw === undefined ? null : Number(profitRaw),
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
  profitAvailable,
}: {
  data: SpaceBreakdown;
  icon: React.ComponentType<{ className?: string }>;
  accent: "bar" | "kitchen";
  profitAvailable: boolean;
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
            <p className="text-[11px] text-slate-500">CA − coût appro. vendu − dépenses</p>
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
          <dt className="text-slate-500">Coût appro. vendu</dt>
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
            className={`text-[18px] font-bold tabular-nums tracking-tight ${
              profitAvailable && data.profit !== null
                ? moneyClass(data.profit, true)
                : "text-slate-400"
            }`}
          >
            {profitAvailable && data.profit !== null
              ? formatReportCell(data.profit, "currency")
              : "—"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

type BeneficesReportPanelProps = {
  report: ReportResult;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
};

export function BeneficesReportPanel({
  report,
  serviceScope = "BOTH",
  activityCode = null,
}: BeneficesReportPanelProps) {
  const pages = getActivityPages(activityCode);
  const showBar = !pages.retail && hasBarService(serviceScope);
  const showKitchen = !pages.retail && hasKitchenService(serviceScope);
  const singleScope = pages.retail || isSingleServiceScope(serviceScope);

  const profitAvailable = report.meta?.profitAvailable !== false;

  const bar = showBar ? readSpace(report.rows, "Bar") : null;
  const kitchen = showKitchen ? readSpace(report.rows, "Cuisine") : null;
  const total = readSpace(report.rows, "Total");

  if (!total) {
    return null;
  }
  if (showBar && !bar) return null;
  if (showKitchen && !kitchen) return null;

  const ProfitIcon =
    profitAvailable && total.profit !== null && total.profit >= 0
      ? TrendingUp
      : TrendingDown;
  const heroTone =
    !profitAvailable || total.profit === null
      ? "border-slate-200 bg-gradient-to-br from-slate-50 to-white"
      : total.profit >= 0
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
        : "border-red-200 bg-gradient-to-br from-red-50 to-white";
  const heroIconTone =
    !profitAvailable || total.profit === null
      ? "bg-slate-100 text-slate-500"
      : total.profit >= 0
        ? "bg-emerald-100 text-emerald-700"
        : "bg-red-100 text-red-700";

  const spaceRows = singleScope
    ? [total]
    : [bar, kitchen, total].filter((row): row is SpaceBreakdown => Boolean(row));

  return (
    <div className="app-scroll h-full space-y-4 overflow-auto p-4 sm:p-5 print:h-auto print:overflow-visible">
      {!profitAvailable ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-[12px] text-amber-950">
          Le bénéfice s&apos;affichera après le premier approvisionnement enregistré. En
          attendant, vous pouvez consulter le chiffre d&apos;affaires, le coût des produits
          vendus et les dépenses.
        </div>
      ) : null}

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
                className={`mt-1 text-[26px] font-bold tabular-nums tracking-tight sm:text-[32px] ${
                  profitAvailable && total.profit !== null
                    ? moneyClass(total.profit, true)
                    : "text-slate-400"
                }`}
              >
                {profitAvailable && total.profit !== null
                  ? formatReportCell(total.profit, "currency")
                  : "—"}
              </p>
              {singleScope || !profitAvailable ? null : (
                <p className="mt-1 text-[12px] text-slate-500">
                  {bar && bar.profit !== null ? (
                    <>Bar {formatReportCell(bar.profit, "currency")}</>
                  ) : null}
                  {bar && bar.profit !== null && kitchen && kitchen.profit !== null ? (
                    <span className="mx-1.5 text-slate-300">·</span>
                  ) : null}
                  {kitchen && kitchen.profit !== null ? (
                    <>Cuisine {formatReportCell(kitchen.profit, "currency")}</>
                  ) : null}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 grid w-full grid-cols-3 gap-2 border-t border-slate-200/60 pt-3 text-left sm:mt-0 sm:w-auto sm:gap-3 sm:border-0 sm:pt-0 sm:text-right">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                CA
              </p>
              <p className="mt-0.5 text-[12px] font-bold tabular-nums text-slate-900 sm:text-[13px]">
                {formatReportCell(total.revenue, "currency")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Coût vendu
              </p>
              <p className="mt-0.5 text-[12px] font-bold tabular-nums text-slate-800 sm:text-[13px]">
                {formatReportCell(total.supplyCost, "currency")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Dépenses
              </p>
              <p className="mt-0.5 text-[12px] font-bold tabular-nums text-slate-800 sm:text-[13px]">
                {formatReportCell(total.expenses, "currency")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {singleScope ? null : (
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {bar ? (
            <SpaceCard data={bar} icon={Wine} accent="bar" profitAvailable={profitAvailable} />
          ) : null}
          {kitchen ? (
            <SpaceCard
              data={kitchen}
              icon={UtensilsCrossed}
              accent="kitchen"
              profitAvailable={profitAvailable}
            />
          ) : null}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-[13px] font-semibold text-slate-900">
            {singleScope ? "Synthèse" : "Synthèse comparative"}
          </h3>
          <p className="text-[11px] text-slate-500">
            Tous les postes visibles : CA, coût appro. vendu, dépenses
            {profitAvailable ? ", bénéfice." : "."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Espace</th>
                <th className="px-4 py-2.5 text-right font-medium">CA</th>
                <th className="px-4 py-2.5 text-right font-medium">Coût appro. vendu</th>
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
                        ? pages.retail
                          ? pages.supply.spaceLabel
                          : serviceScope === "BAR"
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
                      className={`px-4 py-3 text-right tabular-nums ${
                        profitAvailable && row.profit !== null
                          ? moneyClass(row.profit, isTotal)
                          : "text-slate-400"
                      }`}
                    >
                      {profitAvailable && row.profit !== null
                        ? formatReportCell(row.profit, "currency")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Formule : bénéfice = ventes {pages.retail ? "encaissées" : "payées"} − coût
        d&apos;approvisionnement des produits vendus − dépenses
        {pages.retail || singleScope
          ? "."
          : " de l'espace (Bar ou Caisse/Cuisine)."}
        {!profitAvailable
          ? " Disponible après le premier approvisionnement enregistré."
          : null}
      </p>
    </div>
  );
}
