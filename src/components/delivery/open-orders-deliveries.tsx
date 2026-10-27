"use client";

import { useState } from "react";

import { DeliveryCashModal } from "@/components/delivery/delivery-cash-modal";
import { Badge } from "@/components/ui/badge";
import {
  DELIVERY_ORDER_STAGE_LABELS,
  DELIVERY_ORDER_STAGE_TONES,
  deliveryOrderStage,
  formatDeliveryOrderNumber,
} from "@/lib/delivery/constants";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Commandes ouvertes (caisse e-commerce) : livraisons envoyées et leur statut réel. */
export function OpenOrdersDeliveries({ deliveries }: { deliveries: DeliveryOrder[] }) {
  const [cashing, setCashing] = useState<DeliveryOrder | null>(null);

  if (deliveries.length === 0) return null;

  return (
    <section className="mb-5 last:mb-0">
      <h2 className="mb-2 flex items-center gap-2 px-0.5 text-[13px] font-bold uppercase tracking-wide text-slate-500">
        Livraisons
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700">
          {deliveries.length}
        </span>
      </h2>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {deliveries.map((order) => {
          const stage = deliveryOrderStage(order);
          return (
            <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-emerald-700">
                  {formatDeliveryOrderNumber(order.orderNumber)}
                  <span className="ml-2 font-normal text-slate-400">{formatTime(order.createdAt)}</span>
                </p>
                <p className="truncate text-[12px] text-slate-500">
                  {order.customerName ?? "Client"}
                  {order.courierName ? ` · ${order.courierName}` : ""}
                </p>
              </div>
              <span className="pos-tabular text-[14px] font-bold text-slate-900">
                {formatPriceXof(order.totalAmount)}
              </span>
              <Badge tone={DELIVERY_ORDER_STAGE_TONES[stage]}>{DELIVERY_ORDER_STAGE_LABELS[stage]}</Badge>
              {stage === "TO_CASH" ? (
                <button
                  type="button"
                  onClick={() => setCashing(order)}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Encaisser
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {cashing ? <DeliveryCashModal order={cashing} onClose={() => setCashing(null)} /> : null}
    </section>
  );
}
