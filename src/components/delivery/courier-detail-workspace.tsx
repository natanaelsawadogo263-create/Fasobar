"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackageMinus, PackagePlus } from "lucide-react";

import {
  CourierStockModal,
  type CourierStockOption,
} from "@/components/delivery/courier-stock-modal";
import { DeliveryOrderCard } from "@/components/delivery/delivery-order-card";
import {
  DeliveryDailyTable,
  DeliveryPeriodFilter,
  type DeliveryPeriodValue,
} from "@/components/delivery/delivery-period-filter";
import { Badge } from "@/components/ui/badge";
import { useDeliveryOrdersLive } from "@/hooks/use-delivery-orders-live";
import {
  COURIER_MOVEMENT_LABELS,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
} from "@/lib/delivery/constants";
import { deliveryPeriodSearch } from "@/lib/delivery/period";
import type {
  CourierMovement,
  CourierStockLine,
  CourierSummary,
  DeliveryDailyTotal,
  DeliveryOrder,
} from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";
import { formatDateTimeFr } from "@/lib/sales/constants";

type CourierDetailWorkspaceProps = {
  establishmentId: string;
  courier: CourierSummary;
  daily: DeliveryDailyTotal[];
  period: DeliveryPeriodValue;
  stock: CourierStockLine[];
  movements: CourierMovement[];
  orders: DeliveryOrder[];
  allocateOptions: CourierStockOption[];
};

type Tab = "daily" | "deliveries" | "history" | "stock";

const MOVEMENT_TONES = {
  ALLOCATION: "emerald",
  RETURN: "amber",
  DELIVERY: "sky",
} as const;

export function CourierDetailWorkspace({
  establishmentId,
  courier,
  daily,
  period,
  stock,
  movements,
  orders,
  allocateOptions,
}: CourierDetailWorkspaceProps) {
  useDeliveryOrdersLive(establishmentId);
  const [tab, setTab] = useState<Tab>("daily");
  const [modal, setModal] = useState<"allocate" | "return" | null>(null);

  const returnOptions: CourierStockOption[] = stock
    .map((line) => ({
      productId: line.productId,
      name: line.productName,
      available: Math.max(line.quantity - line.reserved, 0),
    }))
    .filter((option) => option.available > 0);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "daily", label: "Par jour" },
    { id: "deliveries", label: `Livraisons (${orders.length})` },
    { id: "history", label: "Mouvements" },
    { id: "stock", label: "Stock actuel" },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
        <Link
          href={`/application/livreurs?${deliveryPeriodSearch(period)}`}
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Tous les livreurs
        </Link>

        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[18px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
              {courier.name}
              {!courier.active ? <Badge>Désactivé</Badge> : null}
            </h1>
            {courier.phone ? (
              <p className="mt-0.5 text-[12px] text-slate-500">{courier.phone}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModal("return")}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <PackageMinus className="h-4 w-4" />
              Retour
            </button>
            <button
              type="button"
              onClick={() => setModal("allocate")}
              disabled={!courier.active}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <PackagePlus className="h-4 w-4" />
              Remettre du stock
            </button>
          </div>
        </header>

        <DeliveryPeriodFilter period={period} basePath={`/application/livreurs/${courier.id}`} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            {
              label: "Chiffre d’affaires",
              value: formatPriceXof(courier.deliveredValue),
              hint: "sur la période",
              highlight: true,
            },
            { label: "Livraisons effectuées", value: String(courier.deliveriesCount), hint: "sur la période" },
            { label: "Articles remis", value: formatDeliveryQuantity(courier.allocated), hint: "sur la période" },
            { label: "Articles livrés", value: formatDeliveryQuantity(courier.delivered), hint: "sur la période" },
            { label: "Articles rendus", value: formatDeliveryQuantity(courier.returned), hint: "sur la période" },
            { label: "Doit lui rester", value: formatDeliveryQuantity(courier.inHand), hint: "actuellement" },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border px-4 py-3.5 shadow-sm ${
                card.highlight ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
              <p
                className={`mt-1 text-[18px] font-bold ${card.highlight ? "text-emerald-800" : "text-slate-900"}`}
              >
                {card.value}
              </p>
              <p className="text-[10px] text-slate-400">{card.hint}</p>
            </div>
          ))}
        </div>

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
              {item.label}
            </button>
          ))}
        </div>

        {tab === "daily" ? <DeliveryDailyTable daily={daily} /> : null}

        {tab === "stock" ? (
          stock.length === 0 ? (
            <Empty text="Ce livreur n’a aucun article en main." />
          ) : (
            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Article</th>
                    <th className="px-3 py-2 text-right font-semibold">Doit lui rester</th>
                    <th className="px-3 py-2 text-right font-semibold">Réservé (en cours)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stock.map((line) => (
                    <tr key={line.productId}>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{line.productName}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                        {formatDeliveryQuantity(line.quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sky-700">
                        {formatDeliveryQuantity(line.reserved)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        ) : null}

        {tab === "history" ? (
          movements.length === 0 ? (
            <Empty text="Aucun mouvement sur cette période." />
          ) : (
            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Article</th>
                    <th className="px-3 py-2 text-right font-semibold">Quantité</th>
                    <th className="px-3 py-2 text-right font-semibold">Avant → après</th>
                    <th className="px-3 py-2 font-semibold">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                        {formatDateTimeFr(movement.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={MOVEMENT_TONES[movement.type]}>
                          {COURIER_MOVEMENT_LABELS[movement.type]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{movement.productName}</td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold ${
                          movement.quantity > 0 ? "text-emerald-700" : "text-slate-700"
                        }`}
                      >
                        {movement.quantity > 0 ? "+" : ""}
                        {formatDeliveryQuantity(movement.quantity)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-500">
                        {formatDeliveryQuantity(movement.quantityBefore)} →{" "}
                        {formatDeliveryQuantity(movement.quantityAfter)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {movement.orderNumber !== null
                          ? formatDeliveryOrderNumber(movement.orderNumber)
                          : (movement.note ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        ) : null}

        {tab === "deliveries" ? (
          orders.length === 0 ? (
            <Empty text="Aucune livraison sur cette période." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {orders.map((order) => (
                <DeliveryOrderCard key={order.id} order={order} />
              ))}
            </div>
          )
        ) : null}
      </div>

      {modal ? (
        <CourierStockModal
          mode={modal}
          courierId={courier.id}
          courierName={courier.name}
          options={modal === "allocate" ? allocateOptions : returnOptions}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-[13px] text-slate-500">
      {text}
    </p>
  );
}
