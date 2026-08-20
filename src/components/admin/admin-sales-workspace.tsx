"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ClipboardList,
  Download,
  Printer,
  ShoppingBag,
  TrendingUp,
  Wine,
} from "lucide-react";

import { downloadCsv } from "@/lib/csv/download-csv";
import { formatOrderNumber } from "@/lib/orders/constants";
import {
  formatDayLabel,
  formatHourLabel,
  formatPriceXof,
} from "@/lib/sales/constants";
import { getActivityPages, isRetailActivity } from "@/lib/activity/pages";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";
import type { SalesFiltersInput, SalesPeriodFilter } from "@/lib/sales/schemas";
import type { AdminSalesPageData } from "@/lib/sales/types";
import type { OrderCashierOption } from "@/lib/orders/types";
import {
  hasBarService,
  hasKitchenService,
  isSingleServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";
import {
  EXPAND_PANEL_CLASS,
  ExpandPanelButton,
  useExpandPanel,
} from "@/components/ui/expand-panel";

type AdminSalesWorkspaceProps = {
  data: AdminSalesPageData;
  filters: SalesFiltersInput;
  cashiers: OrderCashierOption[];
  establishmentName: string;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
};

type TabId = "surplus" | "produits" | "caissiers" | "heures" | "jours";

const TABS: Array<{ id: TabId; label: string; short: string }> = [
  { id: "surplus", label: "Surplus", short: "Surplus" },
  { id: "produits", label: "Produits", short: "Produits" },
  { id: "caissiers", label: "Par caissier·ère", short: "Caissiers" },
  { id: "heures", label: "Par heure", short: "Heures" },
  { id: "jours", label: "Par jour", short: "Jours" },
];

const PERIOD_OPTIONS: Array<{ id: Exclude<SalesPeriodFilter, "custom">; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

export function AdminSalesWorkspace({
  data,
  filters,
  cashiers,
  establishmentName: _establishmentName,
  serviceScope = "BOTH",
  activityCode = null,
}: AdminSalesWorkspaceProps) {
  void _establishmentName;
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("surplus");
  const { expanded, toggle: toggleExpanded } = useExpandPanel();
  const pages = getActivityPages(activityCode);
  const retail = isRetailActivity(activityCode);
  const showBar = hasBarService(serviceScope);
  const showKitchen = hasKitchenService(serviceScope) && !retail;
  const singleScope = isSingleServiceScope(serviceScope) || retail;

  const periodFilter: SalesPeriodFilter = filters.period ?? "day";

  function applyFilters(next: Partial<SalesFiltersInput>) {
    const params = new URLSearchParams();
    const nextPeriod =
      next.period ??
      (next.from !== undefined || next.to !== undefined ? "custom" : periodFilter);

    if (nextPeriod !== "custom") {
      const range = resolveOrderPeriodRange(nextPeriod, toLocalIsoDate(new Date()));
      params.set("period", nextPeriod);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    } else {
      params.set("period", "custom");
      const from = next.from ?? filters.from;
      const to = next.to ?? filters.to;
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }

    const cashierId = next.cashierId !== undefined ? next.cashierId : filters.cashierId;
    if (cashierId) params.set("cashierId", cashierId);
    router.push(`/application/ventes?${params.toString()}`);
  }

  const stats = useMemo(() => {
    const totalSurplus = data.saleSurpluses.reduce(
      (sum, sale) => sum + sale.surplus,
      0,
    );
    const items = [
      {
        title: "Surplus cumulé",
        shortTitle: "Surplus",
        value:
          data.saleSurpluses.length > 0
            ? formatPriceXof(totalSurplus)
            : "—",
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        iconClass: "bg-emerald-50 text-emerald-600",
      },
      {
        title: "Chiffre d'affaires",
        shortTitle: "CA",
        value: formatPriceXof(data.summary.totalRevenue),
        icon: <ShoppingBag className="h-3.5 w-3.5" />,
        iconClass: "bg-sky-50 text-sky-600",
      },
      {
        title: pages.sales.paidTitle,
        shortTitle: pages.sales.paidShort,
        value: String(data.summary.paidOrderCount),
        icon: <ClipboardList className="h-3.5 w-3.5" />,
        iconClass: "bg-violet-50 text-violet-600",
      },
    ];
    if (!retail && showBar) {
      items.push({
        title: singleScope ? "Ventes" : "Ventes Bar",
        shortTitle: singleScope ? "Ventes" : "Bar",
        value: formatPriceXof(data.summary.barRevenue),
        icon: <Wine className="h-3.5 w-3.5" />,
        iconClass: "bg-amber-50 text-amber-700",
      });
    }
    if (!retail && showKitchen) {
      items.push({
        title: singleScope ? "Ventes" : "Ventes Cuisine",
        shortTitle: singleScope ? "Ventes" : "Cuisine",
        value: formatPriceXof(data.summary.kitchenRevenue),
        icon: <Banknote className="h-3.5 w-3.5" />,
        iconClass: "bg-orange-50 text-orange-700",
      });
    }
    return items;
  }, [
    data.summary,
    data.saleSurpluses,
    showBar,
    showKitchen,
    singleScope,
    retail,
    pages.sales.paidTitle,
    pages.sales.paidShort,
  ]);

  function exportCsv() {
    const filenameSuffix = new Date().toISOString().slice(0, 10);

    if (tab === "surplus") {
      downloadCsv(
        `ventes-surplus-${filenameSuffix}.csv`,
        ["Vente", "Date", "Caissier", "Vendu", "Coût produits", "Surplus"],
        data.saleSurpluses.map((sale) => [
          formatOrderNumber(sale.orderNumber),
          sale.paidAt,
          sale.cashierName ?? "",
          sale.saleAmount,
          sale.costAmount,
          sale.surplus,
        ]),
      );
      return;
    }

    if (tab === "produits") {
      downloadCsv(
        `ventes-produits-${filenameSuffix}.csv`,
        ["Produit", "Département", "Quantité", "Chiffre d'affaires"],
        data.topProducts.map((p) => [p.name, p.departmentName, p.quantity, p.revenue]),
      );
      return;
    }

    if (tab === "caissiers") {
      downloadCsv(
        `ventes-caissiers-${filenameSuffix}.csv`,
        ["Caissier·ère", pages.sales.paidTitle, "Chiffre d'affaires"],
        data.byCashier.map((c) => [c.cashierName, c.orderCount, c.revenue]),
      );
      return;
    }

    if (tab === "heures") {
      downloadCsv(
        `ventes-par-heure-${filenameSuffix}.csv`,
        ["Heure", "Commandes", "Chiffre d'affaires"],
        data.byHour.map((h) => [formatHourLabel(h.hour), h.orderCount, h.revenue]),
      );
      return;
    }

    if (tab === "jours") {
      downloadCsv(
        `ventes-par-jour-${filenameSuffix}.csv`,
        ["Date", "Commandes", "Chiffre d'affaires"],
        data.byDay.map((d) => [formatDayLabel(d.date), d.orderCount, d.revenue]),
      );
    }
  }

  const maxHourRevenue = Math.max(1, ...data.byHour.map((h) => h.revenue));
  const hasFilters = Boolean(filters.cashierId) || periodFilter === "custom";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 py-2.5 sm:gap-3 sm:p-3 lg:gap-3.5 lg:p-4">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px] lg:text-[22px]">
            Ventes
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 print:hidden">
          <button
            type="button"
            onClick={exportCsv}
            title="Exporter CSV"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 active:bg-slate-50 sm:h-9 sm:px-3.5 sm:hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            title="Imprimer"
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:inline-flex"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </button>
        </div>
      </header>

      {/* Filtres */}
      <div className="-mx-1 flex shrink-0 flex-wrap items-center gap-1.5 overflow-x-auto px-1 pb-0.5 print:hidden">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => applyFilters({ period: option.id })}
              className={`inline-flex h-9 min-h-9 shrink-0 items-center rounded-md px-2.5 text-[12px] font-semibold transition sm:h-8 sm:min-h-8 sm:text-[11px] ${
                periodFilter === option.id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 active:bg-slate-50 sm:hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="inline-flex h-9 min-h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 sm:h-8 sm:min-h-8">
          Du
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => applyFilters({ from: event.target.value })}
            className="h-7 min-w-[8.5rem] border-0 bg-transparent px-0 text-[12px] text-slate-800 outline-none"
          />
        </label>
        <label className="inline-flex h-9 min-h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 sm:h-8 sm:min-h-8">
          Au
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => applyFilters({ to: event.target.value })}
            className="h-7 min-w-[8.5rem] border-0 bg-transparent px-0 text-[12px] text-slate-800 outline-none"
          />
        </label>
        <select
          value={filters.cashierId ?? ""}
          onChange={(event) => applyFilters({ cashierId: event.target.value })}
          className="h-9 min-h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] sm:h-8 sm:min-h-8"
        >
          <option value="">Tous caissiers</option>
          {cashiers.map((cashier) => (
            <option key={cashier.id} value={cashier.id}>
              {cashier.fullName}
            </option>
          ))}
        </select>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => router.push("/application/ventes")}
            className="h-9 min-h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 active:bg-slate-50 sm:h-8 sm:min-h-8 sm:hover:bg-slate-50"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      {/* KPI mobile : défilement horizontal */}
      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 md:hidden">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="w-[40%] min-w-[8.5rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm"
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {stat.shortTitle}
            </p>
            <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-slate-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* KPI desktop */}
      <div className="hidden shrink-0 flex-wrap gap-2 md:flex print:flex">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="w-[13.5rem] rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${stat.iconClass} print:hidden`}
              >
                {stat.icon}
              </span>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {stat.title}
              </p>
            </div>
            <p className="mt-1 text-[16px] font-bold tabular-nums text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div
        className={
          expanded
            ? `${EXPAND_PANEL_CLASS} gap-2`
            : "flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden"
        }
      >
      <div className="-mx-1 flex shrink-0 items-center gap-1.5 overflow-x-auto px-1 pb-0.5 print:hidden">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-[12px] font-semibold transition sm:h-8 ${
              tab === item.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 active:bg-slate-200"
            }`}
          >
            <span className="sm:hidden">{item.short}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
        <div className="ml-auto shrink-0 print:hidden">
          <ExpandPanelButton expanded={expanded} onToggle={toggleExpanded} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm print:overflow-visible print:border-0 print:shadow-none">
        {data.summary.paidOrderCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-slate-900">Aucune vente</h2>
            <p className="mt-1 max-w-sm text-[12px] text-slate-500">
              Aucune commande payée sur la période. Ajustez les dates ou le caissier.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto print:h-auto print:overflow-visible">
            {tab === "surplus" ? (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {data.saleSurpluses.map((sale) => (
                    <article
                      key={sale.orderId}
                      className="rounded-xl border border-slate-200 px-3.5 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-slate-900">
                            Vente {formatOrderNumber(sale.orderNumber)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            {new Date(sale.paidAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {sale.cashierName ? ` · ${sale.cashierName}` : ""}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 text-[15px] font-bold tabular-nums ${
                            sale.surplus >= 0 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {formatPriceXof(sale.surplus)}
                        </p>
                      </div>
                      <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                        {sale.lines.map((line, index) => (
                          <li
                            key={`${sale.orderId}-${index}`}
                            className="text-[12px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-slate-700">
                                {line.productName}
                                <span className="text-slate-400"> ×{line.quantity}</span>
                              </span>
                              <span
                                className={`shrink-0 font-semibold tabular-nums ${
                                  line.surplus >= 0 ? "text-emerald-700" : "text-red-600"
                                }`}
                              >
                                {formatPriceXof(line.surplus)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Vente {formatPriceXof(line.unitSalePrice)}/u − Achat{" "}
                              {line.hasCost
                                ? `${formatPriceXof(line.unitCostPrice)}/u`
                                : "—"}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Total ligne : vendu {formatPriceXof(sale.saleAmount)} − coût
                        produits {formatPriceXof(sale.costAmount)}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden min-w-full text-left text-[13px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500 print:static">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Vente</th>
                      <th className="px-4 py-3 font-semibold">Produits</th>
                      <th className="px-4 py-3 font-semibold">Vendu</th>
                      <th className="px-4 py-3 font-semibold">Coût produits</th>
                      <th className="px-4 py-3 font-semibold">Surplus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.saleSurpluses.map((sale) => (
                      <tr key={sale.orderId} className="align-top hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {formatOrderNumber(sale.orderNumber)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            {new Date(sale.paidAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {sale.cashierName ? ` · ${sale.cashierName}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <ul className="space-y-1">
                            {sale.lines.map((line, index) => (
                              <li key={`${sale.orderId}-d-${index}`}>
                                {line.productName}{" "}
                                <span className="text-slate-400">×{line.quantity}</span>
                                <span className="ml-2 text-[11px] text-slate-400">
                                  ({formatPriceXof(line.unitSalePrice)}/u −{" "}
                                  {line.hasCost
                                    ? `${formatPriceXof(line.unitCostPrice)}/u`
                                    : "achat ?"}
                                  )
                                </span>
                                <span
                                  className={`ml-2 font-semibold tabular-nums ${
                                    line.surplus >= 0
                                      ? "text-emerald-700"
                                      : "text-red-600"
                                  }`}
                                >
                                  {formatPriceXof(line.surplus)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                          {formatPriceXof(sale.saleAmount)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">
                          {formatPriceXof(sale.costAmount)}
                        </td>
                        <td
                          className={`px-4 py-3 font-bold tabular-nums ${
                            sale.surplus >= 0 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {formatPriceXof(sale.surplus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {tab === "produits" ? (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {data.topProducts.map((product) => (
                    <article
                      key={product.productId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-slate-900">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {product.quantity} vendu{product.quantity > 1 ? "s" : ""}
                          {!singleScope ? ` · ${product.departmentName}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(product.revenue)}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden min-w-full text-left text-[13px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500 print:static">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Produit</th>
                      {singleScope ? null : (
                        <th className="px-4 py-3 font-semibold">Département</th>
                      )}
                      <th className="px-4 py-3 font-semibold">Quantité</th>
                      <th className="px-4 py-3 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topProducts.map((product) => (
                      <tr key={product.productId} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {product.name}
                        </td>
                        {singleScope ? null : (
                          <td className="px-4 py-3 text-slate-600">
                            {product.departmentName}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-700">{product.quantity}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatPriceXof(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {tab === "caissiers" ? (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {data.byCashier.map((cashier) => (
                    <article
                      key={cashier.cashierId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-slate-900">
                          {cashier.cashierName}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {cashier.orderCount} {pages.sales.orderCountLabel}
                          {cashier.orderCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(cashier.revenue)}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden min-w-full text-left text-[13px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500 print:static">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Caissier·ère</th>
                      <th className="px-4 py-3 font-semibold">{pages.sales.paidTitle}</th>
                      <th className="px-4 py-3 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byCashier.map((cashier) => (
                      <tr key={cashier.cashierId} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {cashier.cashierName}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{cashier.orderCount}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatPriceXof(cashier.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {tab === "heures" ? (
              <div className="p-3 sm:p-4">
                <div className="hidden items-end gap-1 sm:flex">
                  {data.byHour.map((entry) => (
                    <div key={entry.hour} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-emerald-500/80"
                        style={{
                          height: `${Math.max(2, Math.round((entry.revenue / maxHourRevenue) * 160))}px`,
                        }}
                        title={formatPriceXof(entry.revenue)}
                      />
                      <span className="text-[9px] text-slate-400">
                        {entry.hour % 3 === 0 ? formatHourLabel(entry.hour) : ""}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 sm:mt-4 md:hidden">
                  {data.byHour
                    .filter((entry) => entry.orderCount > 0)
                    .map((entry) => (
                      <article
                        key={entry.hour}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate-900">
                            {formatHourLabel(entry.hour)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            {entry.orderCount} commande
                            {entry.orderCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                          {formatPriceXof(entry.revenue)}
                        </p>
                      </article>
                    ))}
                </div>

                <table className="mt-4 hidden min-w-full text-left text-[13px] sm:table">
                  <thead className="text-[12px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Heure</th>
                      <th className="px-4 py-3 font-semibold">Commandes</th>
                      <th className="px-4 py-3 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byHour
                      .filter((entry) => entry.orderCount > 0)
                      .map((entry) => (
                        <tr key={entry.hour}>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {formatHourLabel(entry.hour)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{entry.orderCount}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {formatPriceXof(entry.revenue)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {tab === "jours" ? (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {data.byDay.map((day) => (
                    <article
                      key={day.date}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-slate-900">
                          {formatDayLabel(day.date)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {day.orderCount} commande{day.orderCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(day.revenue)}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden min-w-full text-left text-[13px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500 print:static">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Commandes</th>
                      <th className="px-4 py-3 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byDay.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {formatDayLabel(day.date)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{day.orderCount}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatPriceXof(day.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
