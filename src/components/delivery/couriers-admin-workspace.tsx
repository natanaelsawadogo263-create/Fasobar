"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PackagePlus, Phone } from "lucide-react";

import {
  DeliveryPeriodFilter,
  type DeliveryPeriodValue,
} from "@/components/delivery/delivery-period-filter";
import {
  CourierStockModal,
  type CourierStockOption,
} from "@/components/delivery/courier-stock-modal";
import { Badge } from "@/components/ui/badge";
import { useDeliveryOrdersLive } from "@/hooks/use-delivery-orders-live";
import { formatDeliveryQuantity } from "@/lib/delivery/constants";
import { deliveryPeriodSearch } from "@/lib/delivery/period";
import type { CourierSummary } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type CouriersAdminWorkspaceProps = {
  establishmentId: string;
  couriers: CourierSummary[];
  period: DeliveryPeriodValue;
  stockOptions: CourierStockOption[];
};

type CardTone = "default" | "emerald" | "orange";

const CARD_TONES: Record<CardTone, { box: string; value: string }> = {
  default: { box: "border-slate-200 bg-white", value: "text-slate-900" },
  emerald: { box: "border-emerald-200 bg-emerald-50/60", value: "text-emerald-800" },
  orange: { box: "border-orange-200 bg-orange-50/60", value: "text-orange-800" },
};

export function CouriersAdminWorkspace({
  establishmentId,
  couriers,
  period,
  stockOptions,
}: CouriersAdminWorkspaceProps) {
  useDeliveryOrdersLive(establishmentId);
  const [allocateFor, setAllocateFor] = useState<CourierSummary | null>(null);

  const totals = couriers.reduce(
    (acc, courier) => ({
      inHand: acc.inHand + courier.inHand,
      deliveries: acc.deliveries + courier.deliveriesCount,
      cashed: acc.cashed + courier.cashedValue,
      toCash: acc.toCash + courier.toCashValue,
    }),
    { inHand: 0, deliveries: 0, cashed: 0, toCash: 0 },
  );

  // L'essentiel : l'argent et la marchandise encore chez les livreurs.
  const cards: Array<{ label: string; value: string; hint: string; tone?: CardTone }> = [
    {
      label: "Reste à encaisser",
      value: formatPriceXof(totals.toCash),
      hint: "argent chez les livreurs",
      tone: totals.toCash > 0 ? "orange" : "default",
    },
    {
      label: "Articles chez les livreurs",
      value: formatDeliveryQuantity(totals.inHand),
      hint: "actuellement",
    },
    {
      label: "Livraisons",
      value: String(totals.deliveries),
      hint: `${formatPriceXof(totals.cashed)} encaissés`,
      tone: "emerald",
    },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
        <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
          Livreurs
        </h1>

        <DeliveryPeriodFilter period={period} basePath="/application/livreurs" />

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

        {couriers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-[13px] text-slate-500">
            Aucun livreur pour l’instant. Créez un compte avec l’espace « Livreur » dans
            Utilisateurs.
          </p>
        ) : (
          <ul className="grid gap-2 sm:gap-3 md:grid-cols-2">
            {couriers.map((courier) => (
              <li
                key={courier.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold text-slate-900">
                      <span className="truncate">{courier.name}</span>
                      {!courier.active ? <Badge>Désactivé</Badge> : null}
                      {courier.inProgressCount > 0 ? (
                        <Badge tone="sky">{courier.inProgressCount} en cours</Badge>
                      ) : null}
                    </p>
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
                </div>

                <dl className="grid grid-cols-2 gap-2">
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      courier.toCashValue > 0 ? "bg-orange-50" : "bg-slate-50"
                    }`}
                  >
                    <dt className="text-[11px] text-slate-500">Doit encore</dt>
                    <dd
                      className={`truncate text-[15px] font-bold tabular-nums ${
                        courier.toCashValue > 0 ? "text-orange-800" : "text-slate-400"
                      }`}
                    >
                      {formatPriceXof(courier.toCashValue)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] text-slate-500">Articles en main</dt>
                    <dd className="text-[15px] font-bold tabular-nums text-emerald-700">
                      {formatDeliveryQuantity(courier.inHand)}
                    </dd>
                  </div>
                </dl>

                <p className="text-[12px] text-slate-500">
                  Sur la période : {courier.deliveriesCount} livraison
                  {courier.deliveriesCount > 1 ? "s" : ""} ·{" "}
                  <span className="font-semibold text-slate-700">
                    {formatPriceXof(courier.cashedValue)}
                  </span>{" "}
                  encaissés
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllocateFor(courier)}
                    disabled={!courier.active}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <PackagePlus className="h-4 w-4" />
                    Remettre
                  </button>
                  <Link
                    href={`/application/livreurs/${courier.id}?${deliveryPeriodSearch(period)}`}
                    className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Détail
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {allocateFor ? (
        <CourierStockModal
          mode="allocate"
          courierId={allocateFor.id}
          courierName={allocateFor.name}
          options={stockOptions}
          onClose={() => setAllocateFor(null)}
        />
      ) : null}
    </div>
  );
}
