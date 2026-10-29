"use client";

import { useMemo, useState } from "react";
import { MapPin, Phone } from "lucide-react";

import {
  DeliveryPeriodFilter,
  type DeliveryPeriodValue,
} from "@/components/delivery/delivery-period-filter";
import { Badge } from "@/components/ui/badge";
import {
  DELIVERY_ORDER_STAGE_LABELS,
  DELIVERY_ORDER_STAGE_TONES,
  deliveryNetToCash,
  deliveryOrderStage,
  deliveryRetainedFee,
  formatDeliveryLineName,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
  type DeliveryOrderStage,
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

/** Libellés courts : ici toutes les commandes sont déjà livrées. */
const HISTORY_STAGE_LABELS: Partial<Record<DeliveryOrderStage, string>> = {
  TO_CASH: "À encaisser",
  CASHED: "Encaissée",
};

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
    let toCash = 0;
    for (const order of visible) {
      value += order.totalAmount;
      if (order.cashedAt) cashed += order.totalAmount;
      // Le livreur garde ses frais de course : la caisse ne recevra que le reste.
      else toCash += deliveryNetToCash(order);
    }
    return { value, cashed, toCash };
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
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-[14px] font-bold text-slate-900">
              Produits livrés
            </h2>
            <ul className="divide-y divide-slate-100">
              {products.map((product) => (
                <li key={product.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 truncate font-medium text-slate-800">
                    <span className="font-bold tabular-nums">{formatDeliveryQuantity(product.quantity)} ×</span>{" "}
                    {product.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {formatPriceXof(product.value)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-bold text-slate-900">Détail des livraisons</h2>
            {days.map(([date, dayOrders]) => (
              <div key={date} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                  <p className="min-w-0 truncate text-[12px] font-semibold text-slate-700">{formatDayHeading(date)}</p>
                  <p className="shrink-0 text-[12px] tabular-nums text-slate-500">
                    {dayOrders.length} · {formatPriceXof(dayOrders.reduce((sum, order) => sum + order.totalAmount, 0))}
                  </p>
                </header>
                <ul className="divide-y divide-slate-100">
                  {dayOrders.map((order) => {
                    const stage = deliveryOrderStage(order);
                    const fee = deliveryRetainedFee(order);
                    return (
                      <li key={order.id} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-[14px] font-bold text-slate-900">
                            {formatDeliveryOrderNumber(order.orderNumber)}
                          </p>
                          <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                            {formatPriceXof(order.totalAmount)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-[12px] text-slate-500">
                            {formatTime(order.deliveredAt)} · {order.courierName ?? "Sans livreur"}
                            {order.customerName ? ` · ${order.customerName}` : ""}
                          </p>
                          <Badge tone={DELIVERY_ORDER_STAGE_TONES[stage]}>
                            {HISTORY_STAGE_LABELS[stage] ?? DELIVERY_ORDER_STAGE_LABELS[stage]}
                          </Badge>
                        </div>
                        <ul className="divide-y divide-slate-100 rounded-lg bg-slate-50 text-[12px]">
                          {order.items.map((item) => (
                            <li
                              key={`${item.productId}:${item.saleUnitName ?? ""}`}
                              className="flex items-center justify-between gap-3 px-3 py-1.5"
                            >
                              <span className="min-w-0 truncate text-slate-700">
                                <span className="font-semibold">{formatDeliveryQuantity(item.quantity)} ×</span>{" "}
                                {formatDeliveryLineName(item)}
                              </span>
                              <span className="shrink-0 tabular-nums text-slate-500">
                                {formatPriceXof(item.lineTotal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {fee > 0 || order.customerPhone || order.deliveryAddress ? (
                          <div className="flex flex-col gap-1 text-[12px] text-slate-600">
                            {fee > 0 ? (
                              <p>
                                Frais livreur − {formatPriceXof(fee)} · caisse{" "}
                                <span className="font-semibold text-slate-800">
                                  {formatPriceXof(deliveryNetToCash(order))}
                                </span>
                              </p>
                            ) : null}
                            {order.customerPhone ? (
                              <a
                                href={`tel:${order.customerPhone}`}
                                className="inline-flex w-fit items-center gap-1.5 text-emerald-700"
                              >
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                {order.customerPhone}
                              </a>
                            ) : null}
                            {order.deliveryAddress ? (
                              <p className="flex items-start gap-1.5">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="min-w-0 break-words">{order.deliveryAddress}</span>
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
