"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";

import { formatOrderNumber } from "@/lib/orders/constants";
import type { SaleOrderSurplus } from "@/lib/profit/sale-surplus";
import { formatReportCell } from "@/lib/reports/constants";
import type { ReportResult } from "@/lib/reports/types";
import type { ServiceScope } from "@/lib/settings/service-scope";

type BeneficesReportPanelProps = {
  report: ReportResult;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
};

function moneyClass(amount: number, emphasize = false): string {
  if (amount < 0) {
    return emphasize ? "text-red-700" : "text-red-600";
  }
  if (amount > 0) {
    return emphasize ? "text-emerald-700" : "text-emerald-700";
  }
  return emphasize ? "text-slate-900" : "text-slate-700";
}

function formatPaidAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SaleSurplusCard({ sale }: { sale: SaleOrderSurplus }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-slate-50 sm:px-4"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-slate-900">
            Vente {formatOrderNumber(sale.orderNumber)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {formatPaidAt(sale.paidAt)}
            {sale.cashierName ? ` · ${sale.cashierName}` : ""}
            {" · "}
            {sale.lines.length} produit{sale.lines.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Surplus
          </p>
          <p
            className={`text-[16px] font-bold tabular-nums ${moneyClass(sale.surplus, true)}`}
          >
            {formatReportCell(sale.surplus, "currency")}
          </p>
        </div>
      </button>

      {open ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 sm:px-4">
          <div className="mb-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
            <div>
              <p className="uppercase tracking-wide text-slate-400">Vendu</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-800">
                {formatReportCell(sale.saleAmount, "currency")}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-slate-400">Coût appro</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-800">
                {formatReportCell(sale.costAmount, "currency")}
              </p>
            </div>
            <div className="text-right">
              <p className="uppercase tracking-wide text-slate-400">Surplus</p>
              <p
                className={`mt-0.5 font-bold tabular-nums ${moneyClass(sale.surplus)}`}
              >
                {formatReportCell(sale.surplus, "currency")}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {sale.lines.map((line, index) => (
              <li
                key={`${sale.orderId}-${line.productName}-${index}`}
                className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-900">
                      {line.productName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Qté {line.quantity}
                      {!line.hasCost ? " · coût unitaire d’appro manquant" : null}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-[14px] font-bold tabular-nums ${moneyClass(line.surplus)}`}
                  >
                    {formatReportCell(line.surplus, "currency")}
                  </p>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-500 sm:grid-cols-3">
                  <span>
                    Vente/u {formatReportCell(line.unitSalePrice, "currency")}
                  </span>
                  <span>
                    Achat/u{" "}
                    {line.hasCost
                      ? formatReportCell(line.unitCostPrice, "currency")
                      : "—"}
                  </span>
                  <span className="col-span-2 sm:col-span-1">
                    Surplus = vente − achat de ce produit
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export function BeneficesReportPanel({
  report,
}: BeneficesReportPanelProps) {
  const profitAvailable = report.meta?.profitAvailable !== false;
  const saleSurpluses = report.meta?.saleSurpluses ?? [];

  const totalRow = report.rows.find((row) => row.space === "Total");
  const totalProfit =
    totalRow?.profit === null || totalRow?.profit === undefined
      ? null
      : Number(totalRow.profit);
  const totalRevenue = Number(totalRow?.revenue ?? 0);
  const totalCost = Number(totalRow?.supplyCost ?? 0);

  const ProfitIcon =
    profitAvailable && totalProfit !== null && totalProfit >= 0
      ? TrendingUp
      : TrendingDown;
  const heroTone =
    !profitAvailable || totalProfit === null
      ? "border-slate-200 bg-gradient-to-br from-slate-50 to-white"
      : totalProfit >= 0
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
        : "border-red-200 bg-gradient-to-br from-red-50 to-white";
  const heroIconTone =
    !profitAvailable || totalProfit === null
      ? "bg-slate-100 text-slate-500"
      : totalProfit >= 0
        ? "bg-emerald-100 text-emerald-700"
        : "bg-red-100 text-red-700";

  return (
    <div className="app-scroll h-full space-y-4 overflow-auto p-4 sm:p-5 print:h-auto print:overflow-visible">
      <section className={`rounded-xl border p-4 shadow-sm sm:p-5 print:break-inside-avoid ${heroTone}`}>
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${heroIconTone}`}
          >
            <ProfitIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Surplus cumulé
            </p>
            <p
              className={`mt-1 text-[26px] font-bold tabular-nums tracking-tight sm:text-[32px] ${
                profitAvailable && totalProfit !== null
                  ? moneyClass(totalProfit, true)
                  : "text-slate-400"
              }`}
            >
              {profitAvailable && totalProfit !== null
                ? formatReportCell(totalProfit, "currency")
                : "—"}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Somme des surplus de chaque vente ({saleSurpluses.length} vente
              {saleSurpluses.length > 1 ? "s" : ""})
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3 text-left">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Ventes
            </p>
            <p className="mt-0.5 text-[13px] font-bold tabular-nums text-slate-900">
              {formatReportCell(totalRevenue, "currency")}
            </p>
          </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Coût produits vendus
              </p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums text-slate-800">
                {formatReportCell(totalCost, "currency")}
              </p>
            </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">
            Surplus à chaque vente
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Ouvre une vente pour voir le détail produit par produit.
          </p>
        </div>

        {saleSurpluses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-[13px] text-slate-500">
            Aucune vente sur cette période. Le surplus apparaîtra dès la première
            vente.
          </div>
        ) : (
          <div className="space-y-2.5">
            {saleSurpluses.map((sale) => (
              <SaleSurplusCard key={sale.orderId} sale={sale} />
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Pour chaque produit vendu : surplus = prix de vente de ce produit − coût
        unitaire d&apos;achat de ce même produit à l&apos;appro. On ne soustrait
        jamais le montant total du bon d&apos;approvisionnement. Le bénéfice total
        est la somme de ces surplus, vente après vente.
      </p>
    </div>
  );
}
