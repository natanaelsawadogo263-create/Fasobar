"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Phone, User } from "lucide-react";

import {
  DeliveryPeriodFilter,
  type DeliveryPeriodValue,
} from "@/components/delivery/delivery-period-filter";
import { Badge } from "@/components/ui/badge";
import {
  DELIVERY_ORDER_STAGE_LABELS,
  DELIVERY_ORDER_STAGE_TONES,
  deliveryOrderStage,
  formatDeliveryLineName,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
} from "@/lib/delivery/constants";
import { toLocalIsoDate } from "@/lib/delivery/period";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type DeliveryHistoryPanelProps = {
  period: DeliveryPeriodValue;
  /** Livraisons finalisées (livrées) sur la période. */
  orders: DeliveryOrder[];
};

const ALL = "all";

type CourierTotals = {
  id: string;
  name: string;
  deliveries: number;
  value: number;
  cashedValue: number;
};

type ProductTotals = { name: string; quantity: number; value: number };

function courierKey(order: DeliveryOrder): string {
  return order.courierId ?? "none";
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeading(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function StatTile({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "orange" }) {
  const valueColor =
    tone === "emerald" ? "text-emerald-700" : tone === "orange" ? "text-orange-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-[17px] font-bold tabular-nums sm:text-[19px] ${valueColor}`}>{value}</p>
    </div>
  );
}

/** Livraisons effectuées : filtre de période, totaux, détail par livreur et par produit. */
export function DeliveryHistoryPanel({ period, orders }: DeliveryHistoryPanelProps) {
  const [courierFilter, setCourierFilter] = useState<string>(ALL);

  const byCourier = useMemo(() => {
    const map = new Map<string, CourierTotals>();
    for (const order of orders) {
      const id = courierKey(order);
      const entry = map.get(id) ?? {
        id,
        name: order.courierName ?? "Sans livreur",
        deliveries: 0,
        value: 0,
        cashedValue: 0,
      };
      entry.deliveries += 1;
      entry.value += order.totalAmount;
      if (order.cashedAt) entry.cashedValue += order.totalAmount;
      map.set(id, entry);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [orders]);

  // Livreur choisi absent de la nouvelle période : on revient à « Tous ».
  const activeFilter = byCourier.some((courier) => courier.id === courierFilter) ? courierFilter : ALL;

  const visible = useMemo(
    () => (activeFilter === ALL ? orders : orders.filter((order) => courierKey(order) === activeFilter)),
    [orders, activeFilter],
  );

  const totals = useMemo(() => {
    let value = 0;
    let cashed = 0;
    for (const order of visible) {
      value += order.totalAmount;
      if (order.cashedAt) cashed += order.totalAmount;
    }
    return { value, cashed, toCash: value - cashed };
  }, [visible]);

  const products = useMemo(() => {
    const map = new Map<string, ProductTotals>();
    for (const order of visible) {
      for (const item of order.items) {
        const entry = map.get(item.productId) ?? { name: item.productName, quantity: 0, value: 0 };
        entry.quantity += item.stockQuantity;
        entry.value += item.lineTotal;
        map.set(item.productId, entry);
      }
    }
    return [...map.values()].sort((a, b) => b.quantity - a.quantity);
  }, [visible]);

  const days = useMemo(() => {
    const map = new Map<string, DeliveryOrder[]>();
    for (const order of visible) {
      const date = toLocalIsoDate(new Date(order.deliveredAt ?? order.createdAt));
      const list = map.get(date) ?? [];
      list.push(order);
      map.set(date, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [visible]);

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <DeliveryPeriodFilter period={period} basePath="/application/livraisons" />

      {byCourier.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Livreur">
          {[{ id: ALL, name: "Tous les livreurs", deliveries: orders.length }, ...byCourier].map((courier) => {
            const active = activeFilter === courier.id;
            return (
              <button
                key={courier.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCourierFilter(courier.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {courier.name}
                <span className={active ? "text-white/70" : "text-slate-400"}>{courier.deliveries}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Totaux de la période">
        <StatTile label="Livraisons" value={String(visible.length)} />
        <StatTile label="Montant livré" value={formatPriceXof(totals.value)} />
        <StatTile label="Encaissé" value={formatPriceXof(totals.cashed)} tone="emerald" />
        <StatTile
          label="À encaisser"
          value={formatPriceXof(totals.toCash)}
          tone={totals.toCash > 0 ? "orange" : "slate"}
        />
      </section>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-[13px] text-slate-500">
          Aucune livraison effectuée sur cette période.
        </p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            {activeFilter === ALL ? (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <h2 className="border-b border-slate-100 px-4 py-3 text-[14px] font-bold text-slate-900">
                  Par livreur
                </h2>
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Livreur</th>
                      <th className="px-2 py-2 text-right font-semibold">Livr.</th>
                      <th className="px-2 py-2 text-right font-semibold">Montant</th>
                      <th className="px-4 py-2 text-right font-semibold">Encaissé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byCourier.map((courier) => (
                      <tr
                        key={courier.id}
                        onClick={() => setCourierFilter(courier.id)}
                        className="cursor-pointer transition hover:bg-slate-50"
                      >
                        <td className="max-w-[140px] truncate px-4 py-2.5 font-medium text-slate-800">
                          {courier.name}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{courier.deliveries}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-slate-600">
                          {formatPriceXof(courier.value)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                          {formatPriceXof(courier.cashedValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <section
              className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
                activeFilter === ALL ? "" : "lg:col-span-2"
              }`}
            >
              <h2 className="border-b border-slate-100 px-4 py-3 text-[14px] font-bold text-slate-900">
                Produits livrés
              </h2>
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Produit</th>
                    <th className="px-2 py-2 text-right font-semibold">Qté</th>
                    <th className="px-4 py-2 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.name}>
                      <td className="max-w-[180px] truncate px-4 py-2.5 font-medium text-slate-800">
                        {product.name}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                        {formatDeliveryQuantity(product.quantity)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-600">
                        {formatPriceXof(product.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-bold text-slate-900">Détail des livraisons</h2>
            {days.map(([date, dayOrders]) => (
              <div key={date} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                  <p className="text-[12px] font-semibold text-slate-700">{formatDayHeading(date)}</p>
                  <p className="text-[12px] tabular-nums text-slate-500">
                    {dayOrders.length} · {formatPriceXof(dayOrders.reduce((sum, order) => sum + order.totalAmount, 0))}
                  </p>
                </header>
                <ul className="divide-y divide-slate-100">
                  {dayOrders.map((order) => (
                    <li key={order.id}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-slate-900">
                              {formatDeliveryOrderNumber(order.orderNumber)}
                              <span className="font-normal text-slate-400">{formatTime(order.deliveredAt)}</span>
                            </p>
                            <p className="truncate text-[12px] text-slate-500">
                              {order.courierName ?? "Sans livreur"}
                              {order.customerName ? ` · ${order.customerName}` : ""}
                              {` · ${order.items.length} produit${order.items.length > 1 ? "s" : ""}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[13px] font-bold tabular-nums text-slate-900">
                              {formatPriceXof(order.totalAmount)}
                            </span>
                            <Badge tone={DELIVERY_ORDER_STAGE_TONES[deliveryOrderStage(order)]}>
                              {DELIVERY_ORDER_STAGE_LABELS[deliveryOrderStage(order)]}
                            </Badge>
                          </div>
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                        </summary>

                        <div className="flex flex-col gap-2 px-4 pb-3">
                          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/60 text-[13px]">
                            {order.items.map((item) => (
                              <li key={`${item.productId}:${item.saleUnitName ?? ""}`} className="flex items-center justify-between gap-3 px-3 py-2">
                                <span className="min-w-0 truncate text-slate-800">
                                  <span className="font-semibold">{formatDeliveryQuantity(item.quantity)} ×</span>{" "}
                                  {formatDeliveryLineName(item)}
                                </span>
                                <span className="shrink-0 tabular-nums text-slate-600">
                                  {formatPriceXof(item.lineTotal)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {order.customerPhone || order.deliveryAddress ? (
                            <dl className="grid gap-1 text-[12px] text-slate-600">
                              {order.customerName ? (
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  <dd>{order.customerName}</dd>
                                </div>
                              ) : null}
                              {order.customerPhone ? (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  <dd>{order.customerPhone}</dd>
                                </div>
                              ) : null}
                              {order.deliveryAddress ? (
                                <div className="flex items-start gap-2">
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  <dd>{order.deliveryAddress}</dd>
                                </div>
                              ) : null}
                            </dl>
                          ) : null}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
