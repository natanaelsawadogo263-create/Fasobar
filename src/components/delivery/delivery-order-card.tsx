import type { ReactNode } from "react";
import { MapPin, Phone, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DELIVERY_ORDER_STAGE_LABELS,
  DELIVERY_ORDER_STAGE_TONES,
  deliveryOrderStage,
  formatDeliveryLineName,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
} from "@/lib/delivery/constants";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";
import { formatDateTimeFr } from "@/lib/sales/constants";

type DeliveryOrderCardProps = {
  order: DeliveryOrder;
  /** Affiche le livreur (vue caisse / admin). */
  showCourier?: boolean;
  actions?: ReactNode;
};

export function DeliveryOrderCard({ order, showCourier = false, actions }: DeliveryOrderCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-tight text-slate-900">
            {formatDeliveryOrderNumber(order.orderNumber)}
          </p>
          <p className="text-[11px] text-slate-500">{formatDateTimeFr(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={DELIVERY_ORDER_STAGE_TONES[deliveryOrderStage(order)]}>
            {DELIVERY_ORDER_STAGE_LABELS[deliveryOrderStage(order)]}
          </Badge>
          <p className="text-[15px] font-bold text-slate-900">{formatPriceXof(order.totalAmount)}</p>
        </div>
      </header>

      {order.customerName || order.customerPhone || order.deliveryAddress ? (
        <dl className="grid gap-1 text-[13px] text-slate-700">
          {order.customerName ? (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <dd>{order.customerName}</dd>
            </div>
          ) : null}
          {order.customerPhone ? (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <dd>
                <a href={`tel:${order.customerPhone}`} className="text-emerald-700 underline">
                  {order.customerPhone}
                </a>
              </dd>
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

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/60 text-[13px]">
        {order.items.map((item) => (
          <li key={`${item.productId}:${item.saleUnitName ?? ""}`} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 truncate text-slate-800">
              <span className="font-semibold">{formatDeliveryQuantity(item.quantity)} ×</span>{" "}
              {formatDeliveryLineName(item)}
            </span>
            <span className="shrink-0 text-slate-600">{formatPriceXof(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{order.note}</p>
      ) : null}

      {showCourier && order.courierName ? (
        <p className="text-[12px] text-slate-600">
          Livreur : <span className="font-semibold text-slate-800">{order.courierName}</span>
          {order.deliveredAt ? ` · livrée le ${formatDateTimeFr(order.deliveredAt)}` : null}
          {order.cashedAt ? ` · encaissée le ${formatDateTimeFr(order.cashedAt)}` : null}
        </p>
      ) : null}

      {order.status === "CANCELLED" && order.cancelReason ? (
        <p className="text-[12px] text-slate-500">Motif : {order.cancelReason}</p>
      ) : null}

      {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
    </article>
  );
}
