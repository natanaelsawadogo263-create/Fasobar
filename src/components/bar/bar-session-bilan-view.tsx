"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  GlassWater,
  PackageMinus,
  PackagePlus,
  Wrench,
} from "lucide-react";

import { formatPriceXof } from "@/lib/payments/constants";
import { formatQuantity } from "@/lib/stock/constants";
import type {
  BarSessionClosingSummary,
  BarSessionProductQty,
  BarSessionTheoreticalStockItem,
} from "@/lib/bar/session-types";

type BarSessionBilanViewProps = {
  summary: BarSessionClosingSummary;
  compact?: boolean;
};

function ProductTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: BarSessionProductQty[];
  emptyLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-[12px] text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li
              key={`${row.productName}-${row.type ?? ""}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]"
            >
              <span className="min-w-0 truncate font-medium text-slate-800">
                {row.productName}
                {row.type ? (
                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                    ({row.type})
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-slate-900">
                {formatQuantity(row.quantity, row.unit || undefined)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function stockStatus(item: BarSessionTheoreticalStockItem): "out" | "low" | "ok" {
  if (item.quantity <= 0) return "out";
  if (item.isLow) return "low";
  return "ok";
}

const STOCK_STATUS_META = {
  out: {
    label: "Rupture",
    row: "bg-red-50/40",
    badge: "bg-red-100 text-red-800",
    qty: "text-red-700",
  },
  low: {
    label: "Bas",
    row: "bg-amber-50/40",
    badge: "bg-amber-100 text-amber-800",
    qty: "text-amber-800",
  },
  ok: {
    label: "OK",
    row: "",
    badge: "bg-emerald-50 text-emerald-700",
    qty: "text-slate-900",
  },
} as const;

function TheoreticalStockSection({
  items,
}: {
  items: BarSessionTheoreticalStockItem[];
}) {
  const sorted = [...items].sort((a, b) => {
    const rank = { out: 0, low: 1, ok: 2 };
    const diff = rank[stockStatus(a)] - rank[stockStatus(b)];
    if (diff !== 0) return diff;
    return a.productName.localeCompare(b.productName, "fr");
  });

  const outCount = items.filter((i) => stockStatus(i) === "out").length;
  const lowCount = items.filter((i) => stockStatus(i) === "low").length;
  const okCount = items.filter((i) => stockStatus(i) === "ok").length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900">
              Stock théorique final
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Calcul automatique FasoBar — hors inventaire physique.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              {items.length} produit{items.length > 1 ? "s" : ""}
            </span>
            {outCount > 0 ? (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-800">
                {outCount} rupture{outCount > 1 ? "s" : ""}
              </span>
            ) : null}
            {lowCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                {lowCount} bas
              </span>
            ) : null}
            {okCount > 0 ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                {okCount} OK
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-400">
          Aucun article de stock bar lié.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
              <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Produit</th>
                <th className="px-3 py-2.5 text-center font-semibold">État</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Stock restant
                </th>
                <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">
                  Seuil mini
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const status = stockStatus(item);
                const meta = STOCK_STATUS_META[status];
                return (
                  <tr
                    key={item.stockItemId || item.productName}
                    className={`border-b border-slate-100 last:border-0 ${meta.row}`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold leading-tight text-slate-900">
                        {item.productName}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400 sm:hidden">
                        Seuil {formatQuantity(item.minimumQuantity, item.unit)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-[13px] font-bold tabular-nums ${meta.qty}`}
                    >
                      {formatQuantity(item.quantity, item.unit)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-[12px] tabular-nums text-slate-500 sm:table-cell">
                      {formatQuantity(item.minimumQuantity, item.unit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function BarSessionBilanView({
  summary,
  compact = false,
}: BarSessionBilanViewProps) {
  const kpis = [
    {
      label: "Commandes reçues",
      value: summary.ordersReceivedCount,
      icon: ClipboardList,
      tone: "bg-slate-100 text-slate-600",
    },
    {
      label: "Commandes servies",
      value: summary.ordersServedCount,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Commandes validées",
      value: summary.ordersValidatedCount,
      icon: GlassWater,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "Boissons sorties",
      value: formatQuantity(summary.drinksOutQty),
      icon: GlassWater,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Entrées stock",
      value: summary.stockEntriesCount,
      sub:
        summary.stockEntriesCost > 0
          ? formatPriceXof(summary.stockEntriesCost)
          : undefined,
      icon: PackagePlus,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "Pertes / casses",
      value: summary.stockLossesCount,
      sub:
        summary.stockLossesQty > 0
          ? formatQuantity(summary.stockLossesQty)
          : undefined,
      icon: PackageMinus,
      tone: "bg-red-50 text-red-600",
    },
    {
      label: "Corrections",
      value: summary.stockCorrectionsCount,
      icon: Wrench,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      label: "Alertes stock",
      value: summary.lowStockCount,
      icon: AlertTriangle,
      tone: "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${kpi.tone}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="truncate text-[15px] font-bold tabular-nums text-slate-900">
                    {kpi.value}
                  </p>
                  {"sub" in kpi && kpi.sub ? (
                    <p className="truncate text-[10px] text-slate-400">{kpi.sub}</p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ProductTable
          title="Quantités sorties par produit"
          rows={summary.drinksByProduct}
          emptyLabel="Aucune boisson sortie pendant cette session."
        />
        <ProductTable
          title="Entrées de stock enregistrées"
          rows={summary.stockEntriesByProduct}
          emptyLabel="Aucune entrée de stock."
        />
        <ProductTable
          title="Pertes et casses déclarées"
          rows={summary.stockLossesByProduct}
          emptyLabel="Aucune perte déclarée."
        />
        <ProductTable
          title="Corrections effectuées"
          rows={summary.stockCorrectionsByProduct}
          emptyLabel="Aucune correction."
        />
      </div>

      <TheoreticalStockSection items={summary.theoreticalStock} />
    </div>
  );
}
