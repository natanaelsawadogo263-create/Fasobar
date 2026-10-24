"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Hand, PackageCheck, Undo2 } from "lucide-react";

import {
  acceptDeliveryOrderAction,
  completeDeliveryOrderAction,
  releaseDeliveryOrderAction,
} from "@/app/(protected)/application/livreur/actions";
import { DeliveryOrderCard } from "@/components/delivery/delivery-order-card";
import { useToast } from "@/components/ui/toast";
import { useDeliveryOrdersLive } from "@/hooks/use-delivery-orders-live";
import { formatDeliveryQuantity } from "@/lib/delivery/constants";
import type { CourierStockLine, DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type CourierWorkspaceProps = {
  establishmentId: string;
  courierName: string;
  availableOrders: DeliveryOrder[];
  myOrders: DeliveryOrder[];
  deliveredToday: DeliveryOrder[];
  stock: CourierStockLine[];
};

type Tab = "available" | "mine" | "stock";

export function CourierWorkspace({
  establishmentId,
  courierName,
  availableOrders,
  myOrders,
  deliveredToday,
  stock,
}: CourierWorkspaceProps) {
  useDeliveryOrdersLive(establishmentId, { chimeOnNew: true });
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(myOrders.length > 0 ? "mine" : "available");

  const deliveredTodayValue = deliveredToday.reduce((sum, order) => sum + order.totalAmount, 0);

  function run(orderId: string, action: (id: string) => Promise<{ success?: string; error?: string }>) {
    setBusyOrderId(orderId);
    startTransition(async () => {
      const result = await action(orderId);
      setBusyOrderId(null);
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "C’est fait.");
    });
  }

  function confirmComplete(orderId: string) {
    if (!window.confirm("Confirmer que la commande a bien été livrée au client ?")) return;
    run(orderId, completeDeliveryOrderAction);
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "available", label: "Disponibles", count: availableOrders.length },
    { id: "mine", label: "Mes livraisons", count: myOrders.length },
    { id: "stock", label: "Mon stock", count: stock.length },
  ];

  const buttonBase =
    "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
        <header>
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
            Bonjour {courierName}
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500 sm:text-[13px]">
            Aujourd’hui : {deliveredToday.length} livraison{deliveredToday.length > 1 ? "s" : ""}
            {" · "}
            {formatPriceXof(deliveredTodayValue)}
          </p>
        </header>

        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                tab === item.id ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {tab === "available" ? (
          availableOrders.length === 0 ? (
            <EmptyState text="Aucune commande en attente. Vous serez prévenu dès qu’une nouvelle arrive." />
          ) : (
            availableOrders.map((order) => (
              <DeliveryOrderCard
                key={order.id}
                order={order}
                actions={
                  <button
                    type="button"
                    onClick={() => run(order.id, acceptDeliveryOrderAction)}
                    disabled={isPending}
                    className={`${buttonBase} bg-emerald-600 text-white active:bg-emerald-700 sm:hover:bg-emerald-700`}
                  >
                    <Hand className="h-4 w-4" />
                    {busyOrderId === order.id ? "…" : "J’accepte"}
                  </button>
                }
              />
            ))
          )
        ) : null}

        {tab === "mine" ? (
          myOrders.length === 0 ? (
            <EmptyState text="Vous n’avez aucune livraison en cours." />
          ) : (
            myOrders.map((order) => (
              <DeliveryOrderCard
                key={order.id}
                order={order}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => run(order.id, releaseDeliveryOrderAction)}
                      disabled={isPending}
                      className={`${buttonBase} border border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50`}
                    >
                      <Undo2 className="h-4 w-4" />
                      Je me désiste
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmComplete(order.id)}
                      disabled={isPending}
                      className={`${buttonBase} bg-emerald-600 text-white active:bg-emerald-700 sm:hover:bg-emerald-700`}
                    >
                      <PackageCheck className="h-4 w-4" />
                      {busyOrderId === order.id ? "…" : "Livraison terminée"}
                    </button>
                  </>
                }
              />
            ))
          )
        ) : null}

        {tab === "stock" ? (
          stock.length === 0 ? (
            <EmptyState text="Aucun article ne vous a encore été remis." />
          ) : (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Article</th>
                    <th className="px-3 py-2 text-right font-semibold">En main</th>
                    <th className="px-3 py-2 text-right font-semibold">Réservé</th>
                    <th className="px-3 py-2 text-right font-semibold">Libre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stock.map((line) => (
                    <tr key={line.productId}>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{line.productName}</td>
                      <td className="px-3 py-2.5 text-right">{formatDeliveryQuantity(line.quantity)}</td>
                      <td className="px-3 py-2.5 text-right text-sky-700">
                        {formatDeliveryQuantity(line.reserved)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                        {formatDeliveryQuantity(Math.max(line.quantity - line.reserved, 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        ) : null}

        {tab === "mine" && deliveredToday.length > 0 ? (
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {deliveredToday.length} livrée{deliveredToday.length > 1 ? "s" : ""} aujourd’hui
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-[13px] text-slate-500">
      {text}
    </p>
  );
}
