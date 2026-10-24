"use client";

import { useMemo } from "react";
import { PackageCheck, Truck, Undo2 } from "lucide-react";

import { CourierOrderCard } from "@/components/delivery/courier-order-card";
import { CourierPage, elapsedSince, EmptyState, useNow } from "@/components/delivery/courier-ui";
import { courierButtons, useCourierOrderActions } from "@/components/delivery/use-courier-order-actions";
import { InstantLink } from "@/components/layout/instant-link";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type CourierInProgressProps = {
  orders: DeliveryOrder[];
};

/** Livraisons acceptées par le livreur, la plus ancienne en premier. */
export function CourierInProgress({ orders }: CourierInProgressProps) {
  const now = useNow();
  const { isPending, busyOrderId, requestComplete, requestRelease, confirmDialog } =
    useCourierOrderActions();

  const sorted = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(a.acceptedAt ?? a.createdAt).getTime() -
          new Date(b.acceptedAt ?? b.createdAt).getTime(),
      ),
    [orders],
  );

  const toCollect = orders.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <CourierPage
      title="Livraisons en cours"
      description="Une fois la commande remise au client et payée, confirmez la livraison : votre stock est mis à jour."
      aside={
        orders.length > 0 ? (
          <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
            {orders.length} en cours · {formatPriceXof(toCollect)} à encaisser
          </span>
        ) : null
      }
    >
      {sorted.length === 0 ? (
        <>
          <EmptyState
            icon={Truck}
            title="Aucune livraison en cours"
            text="Acceptez une commande dans « Commandes à prendre » pour commencer."
          />
          <InstantLink href="/application/livreur" className={`${courierButtons.primary} self-center`}>
            Voir les commandes à prendre
          </InstantLink>
        </>
      ) : (
        sorted.map((order) => (
          <CourierOrderCard
            key={order.id}
            order={order}
            highlight
            elapsedLabel={elapsedSince(order.acceptedAt ?? order.createdAt, now, "Acceptée")}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => requestRelease(order)}
                  disabled={isPending}
                  className={courierButtons.secondary}
                >
                  <Undo2 className="h-4 w-4" />
                  Me désister
                </button>
                <button
                  type="button"
                  onClick={() => requestComplete(order)}
                  disabled={isPending}
                  className={courierButtons.primary}
                >
                  <PackageCheck className="h-4 w-4" />
                  {busyOrderId === order.id ? "Enregistrement…" : "Livrée"}
                </button>
              </>
            }
          />
        ))
      )}

      {confirmDialog}
    </CourierPage>
  );
}
