import type { ReactNode } from "react";
import { AlertTriangle, Clock3, MapPin, Navigation, Phone, StickyNote, User } from "lucide-react";

import {
  formatDeliveryLineName,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
} from "@/lib/delivery/constants";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

export type StockShortage = {
  productName: string;
  missing: number;
};

type CourierOrderCardProps = {
  order: DeliveryOrder;
  /** Libellé du temps écoulé (« il y a 5 min »), calculé côté client. */
  elapsedLabel: string | null;
  /** Articles que le livreur n'a pas en quantité suffisante (commandes à prendre). */
  shortages?: StockShortage[];
  /** Mise en avant : livraison en cours. */
  highlight?: boolean;
  actions?: ReactNode;
};

function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const contactLink =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition active:bg-slate-50 sm:hover:bg-slate-50";

export function CourierOrderCard({
  order,
  elapsedLabel,
  shortages = [],
  highlight = false,
  actions,
}: CourierOrderCardProps) {
  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
        highlight ? "border-sky-200 ring-1 ring-sky-100" : "border-slate-200"
      }`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="text-[16px] font-bold tracking-tight text-slate-900">
            {formatDeliveryOrderNumber(order.orderNumber)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <Clock3 className="h-3 w-3" />
            {elapsedLabel ?? "—"}
            <span className="text-slate-300">·</span>
            {formatDeliveryQuantity(itemsCount)} article{itemsCount > 1 ? "s" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            À encaisser
          </p>
          <p className="text-[18px] font-bold leading-tight text-emerald-700">
            {formatPriceXof(order.totalAmount)}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 py-3">
        {order.customerName || order.customerPhone || order.deliveryAddress ? (
          <dl className="grid gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700">
            {order.customerName ? (
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <dt className="sr-only">Client</dt>
                <dd className="font-semibold text-slate-900">{order.customerName}</dd>
              </div>
            ) : null}
            {order.customerPhone ? (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <dt className="sr-only">Téléphone</dt>
                <dd>{order.customerPhone}</dd>
              </div>
            ) : null}
            {order.deliveryAddress ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <dt className="sr-only">Adresse</dt>
                <dd className="leading-snug">{order.deliveryAddress}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500">
            Aucune coordonnée client renseignée.
          </p>
        )}

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-[13px]">
          {order.items.map((item) => (
            <li key={`${item.productId}:${item.saleUnitName ?? ""}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate text-slate-800">
                <span className="font-semibold">{formatDeliveryQuantity(item.quantity)} ×</span>{" "}
                {formatDeliveryLineName(item)}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {formatPriceXof(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>

        {order.note ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {order.note}
          </p>
        ) : null}

        {shortages.length > 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Stock insuffisant :{" "}
              {shortages
                .map((item) => `${item.productName} (manque ${formatDeliveryQuantity(item.missing)})`)
                .join(", ")}
              . Demandez un complément à l’administrateur.
            </p>
          </div>
        ) : null}
      </div>

      {order.customerPhone || order.deliveryAddress || actions ? (
        // Mobile : contacts sur une ligne, actions en pleine largeur en dessous.
        <footer className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          {order.customerPhone || order.deliveryAddress ? (
            <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              {order.customerPhone ? (
                <a href={`tel:${order.customerPhone}`} className={contactLink}>
                  <Phone className="h-4 w-4 text-emerald-600" />
                  Appeler
                </a>
              ) : null}
              {order.deliveryAddress ? (
                <a
                  href={mapsHref(order.deliveryAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactLink}
                >
                  <Navigation className="h-4 w-4 text-sky-600" />
                  Itinéraire
                </a>
              ) : null}
            </div>
          ) : null}
          {actions ? (
            <div className="flex gap-2 [&>*]:flex-1 [&>*]:justify-center sm:ml-auto sm:flex-wrap sm:justify-end sm:[&>*]:flex-none">
              {actions}
            </div>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
