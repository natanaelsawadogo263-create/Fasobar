"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ClipboardList,
  Download,
  Printer,
  Search,
  ShoppingBag,
  TrendingUp,
  Wine,
} from "lucide-react";

import { getActivityPages } from "@/lib/activity/pages";
import { downloadCsv } from "@/lib/csv/download-csv";
import { formatOrderNumber } from "@/lib/orders/constants";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";
import {
  formatDateTimeFr,
  formatDayLabel,
  formatHourLabel,
  formatPriceXof,
} from "@/lib/sales/constants";
import type { SalesFiltersInput } from "@/lib/sales/schemas";
import type { AdminSalesPageData } from "@/lib/sales/types";
import type { OrderCashierOption } from "@/lib/orders/types";
import {
  hasBarService,
  hasKitchenService,
  isSingleServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type SalesPeriodFilter = "day" | "week" | "month" | "custom" | "all";

type AdminSalesWorkspaceProps = {
  data: AdminSalesPageData;
  filters: SalesFiltersInput;
  cashiers: OrderCashierOption[];
  establishmentName: string;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
  periodFilter?: SalesPeriodFilter;
  periodLabel?: string | null;
};

type TabId = "tickets" | "produits" | "caissiers" | "heures" | "jours";

const PERIOD_OPTIONS: Array<{ id: Exclude<SalesPeriodFilter, "custom">; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "all", label: "Tout" },
];

function shareOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 1000) / 10);
}

function ShareBar({ value }: { value: number }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-emerald-500"
        style={{ width: `${Math.max(value > 0 ? 4 : 0, value)}%` }}
      />
    </div>
  );
}

export function AdminSalesWorkspace({
  data,
  filters,
  cashiers,
  establishmentName,
  serviceScope = "BOTH",
  activityCode = null,
  periodFilter = "day",
  periodLabel = null,
}: AdminSalesWorkspaceProps) {
  const router = useRouter();
  const pages = getActivityPages(activityCode);
  const [tab, setTab] = useState<TabId>("tickets");
  const [search, setSearch] = useState("");
  const showBar = !pages.retail && hasBarService(serviceScope);
  const showKitchen = !pages.retail && hasKitchenService(serviceScope);
  const singleScope = pages.retail || isSingleServiceScope(serviceScope);
  const totalRevenue = data.summary.totalRevenue;
  const ticketNoun = pages.ticketNoun;

  const tabs: Array<{ id: TabId; label: string; short: string }> = [
    { id: "tickets", label: pages.sales.listTab, short: pages.sales.listTab },
    { id: "produits", label: pages.sales.productsTab, short: pages.sales.productsTab },
    {
      id: "caissiers",
      label: pages.sales.cashierTab,
      short: pages.retail ? "Vendeurs" : "Caissiers",
    },
    { id: "heures", label: "Par heure", short: "Heures" },
    { id: "jours", label: "Par jour", short: "Jours" },
  ];

  function applyFilters(
    next: Partial<SalesFiltersInput> & { period?: SalesPeriodFilter },
  ) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    const nextPeriod =
      next.period ??
      (next.from !== undefined || next.to !== undefined ? "custom" : periodFilter);

    if (nextPeriod && nextPeriod !== "custom" && nextPeriod !== "all") {
      const range = resolveOrderPeriodRange(nextPeriod, toLocalIsoDate(new Date()));
      params.set("period", nextPeriod);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    } else if (nextPeriod === "all") {
      params.set("period", "all");
    } else {
      params.set("period", "custom");
      if (merged.from) params.set("from", merged.from);
      if (merged.to) params.set("to", merged.to);
    }

    if (merged.cashierId) params.set("cashierId", merged.cashierId);
    router.push(`/application/ventes?${params.toString()}`);
  }

  const stats = useMemo(() => {
    const items = [
      {
        title: "Chiffre d'affaires",
        shortTitle: "CA",
        value: formatPriceXof(data.summary.totalRevenue),
        subtitle: pages.sales.paidSubtitle,
        icon: <TrendingUp className="h-4 w-4" />,
        iconClass: "bg-emerald-50 text-emerald-600",
        emphasize: true,
      },
      {
        title: pages.sales.paidTitle,
        shortTitle: pages.sales.paidShort,
        value: String(data.summary.paidOrderCount),
        subtitle: periodLabel ?? "sur la période",
        icon: <ClipboardList className="h-4 w-4" />,
        iconClass: "bg-sky-50 text-sky-600",
        emphasize: false,
      },
      {
        title: "Panier moyen",
        shortTitle: "Panier",
        value: formatPriceXof(data.summary.averageBasket),
        subtitle: pages.sales.basketHint,
        icon: <ShoppingBag className="h-4 w-4" />,
        iconClass: "bg-violet-50 text-violet-600",
        emphasize: false,
      },
    ];
    if (showBar) {
      items.push({
        title: singleScope ? "Ventes" : "Ventes Bar",
        shortTitle: singleScope ? "Ventes" : "Bar",
        value: formatPriceXof(data.summary.barRevenue),
        subtitle: `${shareOf(data.summary.barRevenue, totalRevenue)} % du CA`,
        icon: <Wine className="h-4 w-4" />,
        iconClass: "bg-amber-50 text-amber-700",
        emphasize: false,
      });
    }
    if (showKitchen) {
      items.push({
        title: singleScope ? "Ventes" : "Ventes Cuisine",
        shortTitle: singleScope ? "Ventes" : "Cuisine",
        value: formatPriceXof(data.summary.kitchenRevenue),
        subtitle: `${shareOf(data.summary.kitchenRevenue, totalRevenue)} % du CA`,
        icon: <Banknote className="h-4 w-4" />,
        iconClass: "bg-orange-50 text-orange-700",
        emphasize: false,
      });
    }
    return items;
  }, [
    data.summary,
    pages.sales,
    periodLabel,
    showBar,
    showKitchen,
    singleScope,
    totalRevenue,
  ]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.orders;
    return data.orders.filter((order) => {
      const number = formatOrderNumber(order.orderNumber).toLowerCase();
      const cashier = (order.cashierName ?? "").toLowerCase();
      return number.includes(q) || cashier.includes(q) || String(order.orderNumber).includes(q);
    });
  }, [data.orders, search]);

  function exportCsv() {
    const filenameSuffix = new Date().toISOString().slice(0, 10);

    if (tab === "tickets") {
      downloadCsv(
        `ventes-tickets-${filenameSuffix}.csv`,
        ["N°", "Date", pages.sales.cashierColumn, "Articles", "Montant"],
        filteredOrders.map((order) => [
          formatOrderNumber(order.orderNumber),
          formatDateTimeFr(order.paidAt),
          order.cashierName ?? "—",
          order.itemCount,
          order.totalAmount,
        ]),
      );
      return;
    }

    if (tab === "produits") {
      downloadCsv(
        `ventes-produits-${filenameSuffix}.csv`,
        [pages.sales.productColumn, "Département", "Quantité", "Chiffre d'affaires", "Part"],
        data.topProducts.map((p) => [
          p.name,
          p.departmentName,
          p.quantity,
          p.revenue,
          `${shareOf(p.revenue, totalRevenue)} %`,
        ]),
      );
      return;
    }

    if (tab === "caissiers") {
      downloadCsv(
        `ventes-caissiers-${filenameSuffix}.csv`,
        [pages.sales.cashierColumn, pages.sales.paidTitle, "Chiffre d'affaires", "Part"],
        data.byCashier.map((c) => [
          c.cashierName,
          c.orderCount,
          c.revenue,
          `${shareOf(c.revenue, totalRevenue)} %`,
        ]),
      );
      return;
    }

    if (tab === "heures") {
      downloadCsv(
        `ventes-par-heure-${filenameSuffix}.csv`,
        ["Heure", pages.sales.paidShort, "Chiffre d'affaires"],
        data.byHour.map((h) => [formatHourLabel(h.hour), h.orderCount, h.revenue]),
      );
      return;
    }

    downloadCsv(
      `ventes-par-jour-${filenameSuffix}.csv`,
      ["Date", pages.sales.paidShort, "Chiffre d'affaires"],
      data.byDay.map((d) => [formatDayLabel(d.date), d.orderCount, d.revenue]),
    );
  }

  const maxHourRevenue = Math.max(1, ...data.byHour.map((h) => h.revenue));
  const hasExtraFilters = Boolean(filters.cashierId) || periodFilter === "custom";
  const empty = data.summary.paidOrderCount === 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/60">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:gap-3.5 sm:px-4 sm:pt-4 lg:px-5">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
              Ventes
            </h1>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">
              {establishmentName}
              {periodLabel ? ` · ${periodLabel}` : ""}
              <span className="hidden sm:inline"> · paiements confirmés</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 print:hidden">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 active:bg-slate-50 sm:h-10 sm:hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exporter</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
          </div>
        </header>

        <section className="shrink-0 space-y-2.5 print:hidden">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => applyFilters({ period: option.id })}
                className={`inline-flex h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold transition sm:h-9 ${
                  periodFilter === option.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-50 sm:hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500">
              Du
              <input
                type="date"
                value={filters.from ?? ""}
                onChange={(event) => applyFilters({ from: event.target.value, period: "custom" })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 sm:h-10 sm:w-[10.5rem]"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500">
              Au
              <input
                type="date"
                value={filters.to ?? ""}
                onChange={(event) => applyFilters({ to: event.target.value, period: "custom" })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 sm:h-10 sm:w-[10.5rem]"
              />
            </label>
            <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500 sm:col-span-1">
              {pages.retail ? "Vendeur" : "Caissier"}
              <select
                value={filters.cashierId ?? ""}
                onChange={(event) => applyFilters({ cashierId: event.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 sm:h-10 sm:w-[14rem]"
              >
                <option value="">{pages.sales.cashierFilterAll}</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.fullName}
                  </option>
                ))}
              </select>
            </label>
            {hasExtraFilters ? (
              <button
                type="button"
                onClick={() => router.push("/application/ventes")}
                className="col-span-2 h-11 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 active:bg-slate-50 sm:col-span-1 sm:h-10 sm:w-auto sm:px-4 sm:hover:bg-slate-50"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
        </section>

        <section
          className={`grid shrink-0 gap-2 sm:gap-2.5 ${
            stats.length > 3 ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {stats.map((stat) => (
            <article
              key={stat.title}
              className={`rounded-2xl border bg-white px-3.5 py-3 shadow-sm ${
                stat.emphasize
                  ? "col-span-2 border-emerald-200/80 sm:col-span-1"
                  : "border-slate-200/90"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.iconClass} print:hidden`}
                >
                  {stat.icon}
                </span>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span className="sm:hidden">{stat.shortTitle}</span>
                  <span className="hidden sm:inline">{stat.title}</span>
                </p>
              </div>
              <p className="mt-2 truncate text-[18px] font-bold tabular-nums tracking-tight text-slate-900 sm:text-[20px]">
                {stat.value}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{stat.subtitle}</p>
            </article>
          ))}
        </section>

        <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5 print:hidden">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex h-11 shrink-0 items-center rounded-xl px-3.5 text-[13px] font-semibold transition sm:h-9 ${
                tab === item.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-50 sm:hover:bg-slate-50"
              }`}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm print:overflow-visible print:border-0 print:shadow-none">
          {tab === "tickets" && !empty ? (
            <div className="shrink-0 border-b border-slate-100 px-3 py-2 print:hidden">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Rechercher un ${ticketNoun}, un ${pages.sales.cashierColumn.toLowerCase()}…`}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[13px] text-slate-800 outline-none focus:border-emerald-400 focus:bg-white sm:h-10"
                />
              </label>
            </div>
          ) : null}

          {empty ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-[15px] font-semibold text-slate-900">Aucune vente</h2>
              <p className="mt-1 max-w-sm text-[13px] text-slate-500">{pages.sales.emptyDetail}</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto print:h-auto print:overflow-visible">
              {tab === "tickets" ? (
                <>
                  {filteredOrders.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] text-slate-500">
                      Aucun {ticketNoun} ne correspond à la recherche.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1.5 p-2 md:hidden">
                        {filteredOrders.map((order) => (
                          <Link
                            key={order.id}
                            href={`/application/commandes/${order.id}`}
                            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 active:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold tabular-nums text-slate-900">
                                {formatOrderNumber(order.orderNumber)}
                              </p>
                              <p className="mt-0.5 truncate text-[12px] text-slate-500">
                                {formatDateTimeFr(order.paidAt)}
                                {order.cashierName ? ` · ${order.cashierName}` : ""}
                              </p>
                            </div>
                            <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                              {formatPriceXof(order.totalAmount)}
                            </p>
                          </Link>
                        ))}
                      </div>
                      <table className="hidden min-w-full text-left text-[13px] md:table">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 print:static">
                          <tr>
                            <th className="px-4 py-3 font-semibold">N°</th>
                            <th className="px-4 py-3 font-semibold">Encaissé le</th>
                            <th className="px-4 py-3 font-semibold">{pages.sales.cashierColumn}</th>
                            <th className="px-4 py-3 font-semibold">Articles</th>
                            <th className="px-4 py-3 font-semibold text-right">Montant</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/application/commandes/${order.id}`}
                                  className="font-semibold tabular-nums text-emerald-700 hover:underline"
                                >
                                  {formatOrderNumber(order.orderNumber)}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {formatDateTimeFr(order.paidAt)}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {order.cashierName ?? "—"}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-slate-700">
                                {order.itemCount}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                                {formatPriceXof(order.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              ) : null}

              {tab === "produits" ? (
                <>
                  <div className="space-y-1.5 p-2 md:hidden">
                    {data.topProducts.map((product) => {
                      const share = shareOf(product.revenue, totalRevenue);
                      return (
                        <article
                          key={product.productId}
                          className="rounded-xl border border-slate-200 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-slate-900">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-[12px] text-slate-500">
                                {product.quantity} vendu{product.quantity > 1 ? "s" : ""}
                                {!singleScope ? ` · ${product.departmentName}` : ""}
                                {` · ${share} %`}
                              </p>
                            </div>
                            <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                              {formatPriceXof(product.revenue)}
                            </p>
                          </div>
                          <ShareBar value={share} />
                        </article>
                      );
                    })}
                  </div>
                  <table className="hidden min-w-full text-left text-[13px] md:table">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 print:static">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{pages.sales.productColumn}</th>
                        {singleScope ? null : (
                          <th className="px-4 py-3 font-semibold">Département</th>
                        )}
                        <th className="px-4 py-3 font-semibold">Quantité</th>
                        <th className="px-4 py-3 font-semibold">Chiffre d&apos;affaires</th>
                        <th className="px-4 py-3 font-semibold">Part</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topProducts.map((product) => {
                        const share = shareOf(product.revenue, totalRevenue);
                        return (
                          <tr key={product.productId} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {product.name}
                              <ShareBar value={share} />
                            </td>
                            {singleScope ? null : (
                              <td className="px-4 py-3 text-slate-600">{product.departmentName}</td>
                            )}
                            <td className="px-4 py-3 tabular-nums text-slate-700">
                              {product.quantity}
                            </td>
                            <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                              {formatPriceXof(product.revenue)}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-500">{share} %</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : null}

              {tab === "caissiers" ? (
                <>
                  <div className="space-y-1.5 p-2 md:hidden">
                    {data.byCashier.map((cashier) => {
                      const share = shareOf(cashier.revenue, totalRevenue);
                      return (
                        <article
                          key={cashier.cashierId}
                          className="rounded-xl border border-slate-200 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-slate-900">
                                {cashier.cashierName}
                              </p>
                              <p className="mt-0.5 text-[12px] text-slate-500">
                                {cashier.orderCount} {pages.sales.orderCountLabel}
                                {cashier.orderCount > 1 ? "s" : ""} · {share} %
                              </p>
                            </div>
                            <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                              {formatPriceXof(cashier.revenue)}
                            </p>
                          </div>
                          <ShareBar value={share} />
                        </article>
                      );
                    })}
                  </div>
                  <table className="hidden min-w-full text-left text-[13px] md:table">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 print:static">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{pages.sales.cashierColumn}</th>
                        <th className="px-4 py-3 font-semibold">{pages.sales.paidTitle}</th>
                        <th className="px-4 py-3 font-semibold">Chiffre d&apos;affaires</th>
                        <th className="px-4 py-3 font-semibold">Part</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byCashier.map((cashier) => {
                        const share = shareOf(cashier.revenue, totalRevenue);
                        return (
                          <tr key={cashier.cashierId} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {cashier.cashierName}
                              <ShareBar value={share} />
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-700">
                              {cashier.orderCount}
                            </td>
                            <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                              {formatPriceXof(cashier.revenue)}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-500">{share} %</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : null}

              {tab === "heures" ? (
                <div className="p-3 sm:p-4">
                  <div className="hidden h-36 items-end gap-1 sm:flex">
                    {data.byHour.map((entry) => (
                      <div key={entry.hour} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-md bg-emerald-500/85"
                          style={{
                            height: `${Math.max(2, Math.round((entry.revenue / maxHourRevenue) * 120))}px`,
                          }}
                          title={`${formatHourLabel(entry.hour)} · ${formatPriceXof(entry.revenue)}`}
                        />
                        <span className="text-[9px] text-slate-400">
                          {entry.hour % 3 === 0 ? formatHourLabel(entry.hour) : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 sm:mt-4 md:hidden">
                    {data.byHour
                      .filter((entry) => entry.orderCount > 0)
                      .map((entry) => (
                        <article
                          key={entry.hour}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900">
                              {formatHourLabel(entry.hour)}
                            </p>
                            <p className="mt-0.5 text-[12px] text-slate-500">
                              {entry.orderCount} {pages.sales.orderCountLabel}
                              {entry.orderCount > 1 ? "s" : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                            {formatPriceXof(entry.revenue)}
                          </p>
                        </article>
                      ))}
                  </div>

                  <table className="mt-4 hidden min-w-full text-left text-[13px] md:table">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Heure</th>
                        <th className="px-3 py-2 font-semibold">{pages.sales.paidShort}</th>
                        <th className="px-3 py-2 font-semibold">Chiffre d&apos;affaires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byHour
                        .filter((entry) => entry.orderCount > 0)
                        .map((entry) => (
                          <tr key={entry.hour}>
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {formatHourLabel(entry.hour)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-slate-700">
                              {entry.orderCount}
                            </td>
                            <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
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
                  <div className="space-y-1.5 p-2 md:hidden">
                    {data.byDay.map((day) => (
                      <article
                        key={day.date}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900">
                            {formatDayLabel(day.date)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            {day.orderCount} {pages.sales.orderCountLabel}
                            {day.orderCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                          {formatPriceXof(day.revenue)}
                        </p>
                      </article>
                    ))}
                  </div>
                  <table className="hidden min-w-full text-left text-[13px] md:table">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 print:static">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">{pages.sales.paidShort}</th>
                        <th className="px-4 py-3 font-semibold">Chiffre d&apos;affaires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byDay.map((day) => (
                        <tr key={day.date} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {formatDayLabel(day.date)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-700">{day.orderCount}</td>
                          <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
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
