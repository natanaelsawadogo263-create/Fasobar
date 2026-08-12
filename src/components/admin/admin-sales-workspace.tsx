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
import {
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

type AdminSalesWorkspaceProps = {
  data: AdminSalesPageData;
  filters: SalesFiltersInput;
  cashiers: OrderCashierOption[];
  establishmentName: string;
  serviceScope?: ServiceScope;
};

type TabId = "produits" | "caissiers" | "heures" | "jours";

const TABS: Array<{ id: TabId; label: string; short: string }> = [
  { id: "produits", label: "Produits", short: "Produits" },
  { id: "caissiers", label: "Par caissier·ère", short: "Caissiers" },
  { id: "heures", label: "Par heure", short: "Heures" },
  { id: "jours", label: "Par jour", short: "Jours" },
];

export function AdminSalesWorkspace({
  data,
  filters,
  cashiers,
  establishmentName,
  serviceScope = "BOTH",
}: AdminSalesWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("produits");
  const showBar = hasBarService(serviceScope);
  const showKitchen = hasKitchenService(serviceScope);
  const singleScope = isSingleServiceScope(serviceScope);

  function applyFilters(next: Partial<SalesFiltersInput>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.cashierId) params.set("cashierId", merged.cashierId);
    router.push(`/application/ventes?${params.toString()}`);
  }

  const stats = useMemo(() => {
    const items = [
      {
        title: "Chiffre d'affaires",
        shortTitle: "CA",
        value: formatPriceXof(data.summary.totalRevenue),
        subtitle: "commandes payées",
        icon: <TrendingUp className="h-4 w-4" />,
        iconClass: "bg-emerald-50 text-emerald-600",
      },
      {
        title: "Commandes payées",
        shortTitle: "Commandes",
        value: String(data.summary.paidOrderCount),
        subtitle: "sur la période",
        icon: <ClipboardList className="h-4 w-4" />,
        iconClass: "bg-sky-50 text-sky-600",
      },
      {
        title: "Panier moyen",
        shortTitle: "Panier",
        value: formatPriceXof(data.summary.averageBasket),
        subtitle: "par commande",
        icon: <ShoppingBag className="h-4 w-4" />,
        iconClass: "bg-violet-50 text-violet-600",
      },
    ];
    if (showBar) {
      items.push({
        title: singleScope ? "Ventes" : "Ventes Bar",
        shortTitle: singleScope ? "Ventes" : "Bar",
        value: formatPriceXof(data.summary.barRevenue),
        subtitle: "boissons",
        icon: <Wine className="h-4 w-4" />,
        iconClass: "bg-amber-50 text-amber-700",
      });
    }
    if (showKitchen) {
      items.push({
        title: singleScope ? "Ventes" : "Ventes Cuisine",
        shortTitle: singleScope ? "Ventes" : "Cuisine",
        value: formatPriceXof(data.summary.kitchenRevenue),
        subtitle: "nourriture",
        icon: <Banknote className="h-4 w-4" />,
        iconClass: "bg-orange-50 text-orange-700",
      });
    }
    return items;
  }, [data.summary, showBar, showKitchen, singleScope]);

  function exportCsv() {
    const filenameSuffix = new Date().toISOString().slice(0, 10);

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
        ["Caissier·ère", "Commandes payées", "Chiffre d'affaires"],
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
  const hasFilters = Boolean(filters.from || filters.to || filters.cashierId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 py-2.5 sm:gap-3 sm:p-3 lg:gap-3.5 lg:p-4">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px] lg:text-[22px]">
            Ventes
          </h1>
          <p className="mt-0.5 hidden text-[12px] text-slate-500 sm:block">
            {establishmentName} · paiements confirmés
          </p>
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
      <div className="grid shrink-0 grid-cols-2 gap-2 print:hidden sm:flex sm:flex-wrap sm:items-center">
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500 sm:flex-row sm:items-center sm:gap-1.5 sm:text-[12px]">
          Du
          <input
            type="date"
            defaultValue={filters.from ?? ""}
            onChange={(event) => applyFilters({ from: event.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:h-9 sm:w-auto sm:text-[12px]"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500 sm:flex-row sm:items-center sm:gap-1.5 sm:text-[12px]">
          Au
          <input
            type="date"
            defaultValue={filters.to ?? ""}
            onChange={(event) => applyFilters({ to: event.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:h-9 sm:w-auto sm:text-[12px]"
          />
        </label>
        <select
          value={filters.cashierId ?? ""}
          onChange={(event) => applyFilters({ cashierId: event.target.value })}
          className="col-span-2 h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:col-span-1 sm:h-9 sm:text-[12px]"
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
            className="col-span-2 h-10 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-600 active:bg-slate-50 sm:col-span-1 sm:h-9 sm:border-0 sm:px-2.5 sm:hover:text-slate-700"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      {/* KPI mobile : défilement horizontal */}
      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 md:hidden">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="w-[42%] min-w-[9.5rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm"
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {stat.shortTitle}
            </p>
            <p className="mt-1 truncate text-[15px] font-bold tabular-nums text-slate-900">
              {stat.value}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      {/* KPI desktop */}
      <div className="hidden shrink-0 grid-cols-2 gap-2.5 md:grid lg:grid-cols-5 lg:gap-3 print:grid print:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${stat.iconClass} print:hidden`}
              >
                {stat.icon}
              </span>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {stat.title}
              </p>
            </div>
            <p className="mt-1.5 text-[17px] font-bold text-slate-900">{stat.value}</p>
            <p className="text-[11px] text-slate-500">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5 print:hidden">
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
            {tab === "produits" ? (
              <>
                <div className="space-y-1.5 p-2 md:hidden">
                  {data.topProducts.map((product) => (
                    <article
                      key={product.productId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {product.quantity} vendu{product.quantity > 1 ? "s" : ""}
                          {!singleScope ? ` · ${product.departmentName}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(product.revenue)}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden min-w-full text-left text-[12px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 print:static">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Produit</th>
                      {singleScope ? null : (
                        <th className="px-3 py-2.5 font-semibold">Département</th>
                      )}
                      <th className="px-3 py-2.5 font-semibold">Quantité</th>
                      <th className="px-3 py-2.5 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topProducts.map((product) => (
                      <tr key={product.productId} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {product.name}
                        </td>
                        {singleScope ? null : (
                          <td className="px-3 py-2.5 text-slate-600">
                            {product.departmentName}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-slate-700">{product.quantity}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
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
                <div className="space-y-1.5 p-2 md:hidden">
                  {data.byCashier.map((cashier) => (
                    <article
                      key={cashier.cashierId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {cashier.cashierName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {cashier.orderCount} commande
                          {cashier.orderCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(cashier.revenue)}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden min-w-full text-left text-[12px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 print:static">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Caissier·ère</th>
                      <th className="px-3 py-2.5 font-semibold">Commandes payées</th>
                      <th className="px-3 py-2.5 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byCashier.map((cashier) => (
                      <tr key={cashier.cashierId} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {cashier.cashierName}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{cashier.orderCount}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
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
                          height: `${Math.max(2, Math.round((entry.revenue / maxHourRevenue) * 120))}px`,
                        }}
                        title={formatPriceXof(entry.revenue)}
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
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900">
                            {formatHourLabel(entry.hour)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {entry.orderCount} commande
                            {entry.orderCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                          {formatPriceXof(entry.revenue)}
                        </p>
                      </article>
                    ))}
                </div>

                <table className="mt-4 hidden min-w-full text-left text-[12px] sm:table">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Heure</th>
                      <th className="px-3 py-2 font-semibold">Commandes</th>
                      <th className="px-3 py-2 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byHour
                      .filter((entry) => entry.orderCount > 0)
                      .map((entry) => (
                        <tr key={entry.hour}>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {formatHourLabel(entry.hour)}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{entry.orderCount}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
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
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900">
                          {formatDayLabel(day.date)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {day.orderCount} commande{day.orderCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(day.revenue)}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden min-w-full text-left text-[12px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 print:static">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Commandes</th>
                      <th className="px-3 py-2.5 font-semibold">Chiffre d&apos;affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byDay.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {formatDayLabel(day.date)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{day.orderCount}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
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
  );
}
