"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackageMinus, PackagePlus, Phone } from "lucide-react";

import {
  CourierStockModal,
  type CourierStockOption,
} from "@/components/delivery/courier-stock-modal";
import { DeliveryOrderCard } from "@/components/delivery/delivery-order-card";
import {
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
  DeliveryOrder,
} from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";
import { formatDateTimeFr } from "@/lib/sales/constants";

type CourierDetailWorkspaceProps = {
  establishmentId: string;
  courier: CourierSummary;
  period: DeliveryPeriodValue;
  stock: CourierStockLine[];
  movements: CourierMovement[];
  orders: DeliveryOrder[];
  allocateOptions: CourierStockOption[];
};

type Tab = "deliveries" | "stock" | "history";

const MOVEMENT_TONES = {
  ALLOCATION: "emerald",
  RETURN: "amber",
  DELIVERY: "sky",
} as const;

type CardTone = "default" | "emerald" | "orange";

const CARD_TONES: Record<CardTone, { box: string; value: string }> = {
  default: { box: "border-slate-200 bg-white", value: "text-slate-900" },
  emerald: { box: "border-emerald-200 bg-emerald-50/60", value: "text-emerald-800" },
  orange: { box: "border-orange-200 bg-orange-50/60", value: "text-orange-800" },
};

export function CourierDetailWorkspace({
  establishmentId,
  courier,
  period,
  stock,
  movements,
  orders,
  allocateOptions,
}: CourierDetailWorkspaceProps) {
  useDeliveryOrdersLive(establishmentId);
  const [tab, setTab] = useState<Tab>("deliveries");
  const [modal, setModal] = useState<"allocate" | "return" | null>(null);

  const returnOptions: CourierStockOption[] = stock
    .map((line) => ({
      productId: line.productId,
      name: line.productName,
      available: Math.max(line.quantity - line.reserved, 0),
    }))
    .filter((option) => option.available > 0);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "deliveries", label: `Livraisons (${orders.length})` },
    { id: "stock", label: "Stock" },
    { id: "history", label: "Mouvements" },
  ];

  const cards: Array<{ label: string; value: string; hint: string; tone?: CardTone }> = [
    {
      label: "Doit encore",
      value: formatPriceXof(courier.toCashValue),
      hint: `${courier.toCashCount} livraison${courier.toCashCount > 1 ? "s" : ""} à encaisser`,
      tone: courier.toCashValue > 0 ? "orange" : "default",
    },
    {
      label: "Articles en main",
      value: formatDeliveryQuantity(courier.inHand),
      hint: "actuellement",
    },
    {
      label: "Livraisons",
      value: String(courier.deliveriesCount),
      hint: `${formatPriceXof(courier.cashedValue)} encaissés`,
      tone: "emerald",
    },
  ];

  return (
    <div className="app-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 pb-8 pt-3 sm:gap-5 sm:px-4 sm:pb-8 sm:pt-4 lg:px-6 lg:pt-5">
        <Link
          href={`/application/livreurs?${deliveryPeriodSearch(period)}`}
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Tous les livreurs
        </Link>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[18px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
              <span className="truncate">{courier.name}</span>
              {!courier.active ? <Badge>Désactivé</Badge> : null}
              {courier.inProgressCount > 0 ? (
                <Badge tone="sky">{courier.inProgressCount} en cours</Badge>
              ) : null}
            </h1>
            {courier.phone ? (
              <a
                href={`tel:${courier.phone}`}
                className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-slate-500"
              >
                <Phone className="h-3 w-3" />
                {courier.phone}
              </a>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => setModal("return")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <PackageMinus className="h-4 w-4" />
              Retour
            </button>
            <button
              type="button"
              onClick={() => setModal("allocate")}
              disabled={!courier.active}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <PackagePlus className="h-4 w-4" />
              Remettre
            </button>
          </div>
        </header>

        <DeliveryPeriodFilter period={period} basePath={`/application/livreurs/${courier.id}`} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {cards.map((card, index) => (
            <div
              key={card.label}
              className={`min-w-0 rounded-xl border px-3 py-3 shadow-sm sm:px-4 sm:py-3.5 ${
                CARD_TONES[card.tone ?? "default"].box
              } ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
            >
              <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
              <p
                className={`mt-1 truncate text-[18px] font-bold tabular-nums ${
                  CARD_TONES[card.tone ?? "default"].value
                }`}
              >
                {card.value}
              </p>
              <p className="truncate text-[10px] text-slate-400">{card.hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`truncate rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                tab === item.id ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

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

        {tab === "stock" ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[12px] text-slate-600">
              Sur la période : remis {formatDeliveryQuantity(courier.allocated)} · livrés{" "}
              {formatDeliveryQuantity(courier.delivered)} · rendus{" "}
              {formatDeliveryQuantity(courier.returned)}
            </p>
            {stock.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-500">
                Ce livreur n’a aucun article en main.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {stock.map((line) => (
                  <li key={line.productId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 truncate text-[13px] font-medium text-slate-800">
                      {line.productName}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-bold tabular-nums text-emerald-700">
                        {formatDeliveryQuantity(line.quantity)}
                      </span>
                      {line.reserved > 0 ? (
                        <span className="block text-[11px] text-sky-700">
                          dont {formatDeliveryQuantity(line.reserved)} en livraison
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "history" ? (
          movements.length === 0 ? (
            <Empty text="Aucun mouvement sur cette période." />
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {movements.map((movement) => (
                <li key={movement.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-slate-800">
                      <Badge tone={MOVEMENT_TONES[movement.type]}>
                        {COURIER_MOVEMENT_LABELS[movement.type]}
                      </Badge>
                      <span className="truncate">{movement.productName}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {formatDateTimeFr(movement.createdAt)}
                      {movement.orderNumber !== null
                        ? ` · ${formatDeliveryOrderNumber(movement.orderNumber)}`
                        : movement.note
                          ? ` · ${movement.note}`
                          : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-[14px] font-bold tabular-nums ${
                        movement.quantity > 0 ? "text-emerald-700" : "text-slate-700"
                      }`}
                    >
                      {movement.quantity > 0 ? "+" : ""}
                      {formatDeliveryQuantity(movement.quantity)}
                    </p>
                    <p className="text-[11px] tabular-nums text-slate-400">
                      {formatDeliveryQuantity(movement.quantityBefore)} →{" "}
                      {formatDeliveryQuantity(movement.quantityAfter)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
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
