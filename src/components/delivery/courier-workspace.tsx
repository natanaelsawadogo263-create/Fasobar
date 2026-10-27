"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Hand, Inbox, Radio, Truck, Wallet } from "lucide-react";

import { CourierOrderCard, type StockShortage } from "@/components/delivery/courier-order-card";
import {
  CourierPage,
  elapsedSince,
  EmptyState,
  Section,
  StatCard,
  useNow,
} from "@/components/delivery/courier-ui";
import { courierButtons, useCourierOrderActions } from "@/components/delivery/use-courier-order-actions";
import type { CourierStockLine, DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type CourierWorkspaceProps = {
  courierName: string;
  availableOrders: DeliveryOrder[];
  inProgressCount: number;
  toCollectValue: number;
  deliveredTodayCount: number;
  /** Livrées non encaissées par la caisse (toutes dates). */
  toRemitCount: number;
  toRemitValue: number;
  stock: CourierStockLine[];
};

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** Accueil du livreur : résumé du jour et commandes à prendre. */
export function CourierWorkspace({
  courierName,
  availableOrders,
  inProgressCount,
  toCollectValue,
  deliveredTodayCount,
  toRemitCount,
  toRemitValue,
  stock,
}: CourierWorkspaceProps) {
  const router = useRouter();
  const now = useNow();
  const { isPending, busyOrderId, accept, confirmDialog } = useCourierOrderActions();

  /** Stock libre (en main − réservé) par article, pour prévenir avant d'accepter. */
  const freeStock = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of stock) {
      map.set(line.productId, Math.max(line.quantity - line.reserved, 0));
    }
    return map;
  }, [stock]);

  function shortagesFor(order: DeliveryOrder): StockShortage[] {
    return order.items
      .map((item) => ({
        productName: item.productName,
        missing: item.quantity - (freeStock.get(item.productId) ?? 0),
      }))
      .filter((item) => item.missing > 0);
  }

  return (
    <CourierPage
      title={`Bonjour ${firstName(courierName)}`}
      aside={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          Réception en direct
        </span>
      }
    >
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Résumé du jour">
        <StatCard
          icon={Inbox}
          tone="amber"
          label="À prendre"
          value={String(availableOrders.length)}
          hint="commandes en attente"
        />
        <StatCard
          icon={Truck}
          tone="sky"
          label="En cours"
          value={String(inProgressCount)}
          hint={inProgressCount > 0 ? `${formatPriceXof(toCollectValue)} à encaisser` : "aucune livraison"}
          href="/application/livreur/en-cours"
        />
        <StatCard
          icon={CheckCircle2}
          tone="emerald"
          label="Livrées"
          value={String(deliveredTodayCount)}
          hint="aujourd’hui"
          href="/application/livreur/historique?periode=aujourdhui"
        />
        <StatCard
          icon={Wallet}
          tone={toRemitCount > 0 ? "amber" : "slate"}
          label="À remettre"
          value={formatPriceXof(toRemitValue)}
          hint={
            toRemitCount > 0
              ? `${toRemitCount} livraison${toRemitCount > 1 ? "s" : ""} · à la caisse`
              : "rien à remettre"
          }
          href="/application/livreur/historique?periode=30j"
        />
      </section>

      <Section
        title="Commandes à prendre"
      >
        {availableOrders.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Aucune commande en attente"
            text="Gardez l’application ouverte : un signal sonore vous prévient dès qu’une nouvelle commande arrive."
          />
        ) : (
          availableOrders.map((order) => (
            <CourierOrderCard
              key={order.id}
              order={order}
              elapsedLabel={elapsedSince(order.createdAt, now, "Reçue")}
              shortages={shortagesFor(order)}
              actions={
                <button
                  type="button"
                  onClick={() => accept(order, () => router.push("/application/livreur/en-cours"))}
                  disabled={isPending}
                  className={courierButtons.primary}
                >
                  <Hand className="h-4 w-4" />
                  {busyOrderId === order.id ? "Acceptation…" : "J’accepte"}
                </button>
              }
            />
          ))
        )}
      </Section>

      {confirmDialog}
    </CourierPage>
  );
}
