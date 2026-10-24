"use client";

import { Boxes } from "lucide-react";

import { CourierPage, EmptyState, Section } from "@/components/delivery/courier-ui";
import { Badge } from "@/components/ui/badge";
import {
  COURIER_MOVEMENT_LABELS,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
} from "@/lib/delivery/constants";
import type {
  CourierMovement,
  CourierStockLine,
  CourierStockMovementType,
} from "@/lib/delivery/types";
import { formatDateTimeFr } from "@/lib/sales/constants";

type CourierStockProps = {
  stock: CourierStockLine[];
  movements: CourierMovement[];
};

const MOVEMENT_TONES: Record<CourierStockMovementType, "emerald" | "amber" | "sky"> = {
  ALLOCATION: "emerald",
  RETURN: "amber",
  DELIVERY: "sky",
};

/** Stock remis au livreur et derniers mouvements. */
export function CourierStock({ stock, movements }: CourierStockProps) {
  return (
    <CourierPage
      title="Mon stock"
      description="Articles remis par l’administrateur. « Réservé » = déjà engagé dans vos livraisons en cours."
    >
      <Section title="Stock en main">
        {stock.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Aucun article en main"
            text="L’administrateur doit vous remettre du stock avant que vous puissiez accepter des commandes."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Article</th>
                  <th className="px-2 py-2.5 text-right font-semibold">En main</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Réservé</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Libre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stock.map((line) => {
                  const free = Math.max(line.quantity - line.reserved, 0);
                  return (
                    <tr key={line.productId}>
                      <td className="px-4 py-3 font-medium text-slate-800">{line.productName}</td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {formatDeliveryQuantity(line.quantity)}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-sky-700">
                        {line.reserved > 0 ? formatDeliveryQuantity(line.reserved) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-[12px] font-bold tabular-nums ${
                            free > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {formatDeliveryQuantity(free)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Derniers mouvements" description="Remises, retours et livraisons sur votre stock.">
        {movements.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucun mouvement" text="L’historique de votre stock apparaîtra ici." />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                    <Badge tone={MOVEMENT_TONES[movement.type]}>
                      {COURIER_MOVEMENT_LABELS[movement.type]}
                    </Badge>
                    <span className="truncate">{movement.productName}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {formatDateTimeFr(movement.createdAt)}
                    {movement.orderNumber !== null
                      ? ` · ${formatDeliveryOrderNumber(movement.orderNumber)}`
                      : ""}
                    {movement.note ? ` · ${movement.note}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-[14px] font-bold tabular-nums ${
                      movement.quantity > 0 ? "text-emerald-700" : "text-slate-700"
                    }`}
                  >
                    {movement.quantity > 0 ? "+" : "−"}
                    {formatDeliveryQuantity(Math.abs(movement.quantity))}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    reste {formatDeliveryQuantity(movement.quantityAfter)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </CourierPage>
  );
}
