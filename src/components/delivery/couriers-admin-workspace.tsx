"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PackagePlus } from "lucide-react";

import {
  DeliveryDailyTable,
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
import type { CourierSummary, DeliveryDailyTotal } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type CouriersAdminWorkspaceProps = {
  establishmentId: string;
  couriers: CourierSummary[];
  daily: DeliveryDailyTotal[];
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
  daily,
  period,
  stockOptions,
}: CouriersAdminWorkspaceProps) {
  useDeliveryOrdersLive(establishmentId);
  const [allocateFor, setAllocateFor] = useState<CourierSummary | null>(null);

  const totals = couriers.reduce(
    (acc, courier) => ({
      inHand: acc.inHand + courier.inHand,
      deliveries: acc.deliveries + courier.deliveriesCount,
      value: acc.value + courier.deliveredValue,
      cashed: acc.cashed + courier.cashedValue,
      toCash: acc.toCash + courier.toCashValue,
      inProgress: acc.inProgress + courier.inProgressCount,
    }),
    { inHand: 0, deliveries: 0, value: 0, cashed: 0, toCash: 0, inProgress: 0 },
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
        <header className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
              Livreurs
            </h1>
          </div>
        </header>

        <DeliveryPeriodFilter period={period} basePath="/application/livreurs" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {([
            {
              label: "Chiffre d’affaires encaissé",
              value: formatPriceXof(totals.cashed),
              hint: `sur ${formatPriceXof(totals.value)} livrés`,
              tone: "emerald",
            },
            { label: "Livraisons effectuées", value: String(totals.deliveries), hint: "sur la période" },
            {
              label: "Reste à encaisser",
              value: formatPriceXof(totals.toCash),
              hint: "argent chez les livreurs",
              tone: totals.toCash > 0 ? "orange" : "default",
            },
            { label: "Livraisons en cours", value: String(totals.inProgress), hint: "actuellement" },
            {
              label: "Articles chez les livreurs",
              value: formatDeliveryQuantity(totals.inHand),
              hint: "actuellement",
            },
          ] as Array<{ label: string; value: string; hint: string; tone?: CardTone }>).map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border px-4 py-3.5 shadow-sm ${CARD_TONES[card.tone ?? "default"].box}`}
            >
              <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
              <p className={`mt-1 text-[18px] font-bold ${CARD_TONES[card.tone ?? "default"].value}`}>
                {card.value}
              </p>
              <p className="text-[10px] text-slate-400">{card.hint}</p>
            </div>
          ))}
        </div>

        {couriers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-[13px] text-slate-500">
            Aucun livreur pour l’instant. Créez un compte avec l’espace « Livreur » dans
            Utilisateurs.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Livreur</th>
                  <th className="px-3 py-2 text-right font-semibold">Remis</th>
                  <th className="px-3 py-2 text-right font-semibold">Livrés</th>
                  <th className="px-3 py-2 text-right font-semibold">Rendus</th>
                  <th className="px-3 py-2 text-right font-semibold">Doit lui rester*</th>
                  <th className="px-3 py-2 text-right font-semibold">Livraisons</th>
                  <th className="px-3 py-2 text-right font-semibold">Encaissé</th>
                  <th className="px-3 py-2 text-right font-semibold">À encaisser*</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {couriers.map((courier) => (
                  <tr key={courier.id} className="align-middle">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{courier.name}</span>
                        {!courier.active ? <Badge>Désactivé</Badge> : null}
                        {courier.inProgressCount > 0 ? (
                          <Badge tone="sky">{courier.inProgressCount} en cours</Badge>
                        ) : null}
                      </div>
                      {courier.phone ? (
                        <p className="text-[11px] text-slate-500">{courier.phone}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatDeliveryQuantity(courier.allocated)}</td>
                    <td className="px-3 py-2.5 text-right">{formatDeliveryQuantity(courier.delivered)}</td>
                    <td className="px-3 py-2.5 text-right">{formatDeliveryQuantity(courier.returned)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                      {formatDeliveryQuantity(courier.inHand)}
                    </td>
                    <td className="px-3 py-2.5 text-right">{courier.deliveriesCount}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {formatPriceXof(courier.cashedValue)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold ${
                        courier.toCashValue > 0 ? "text-orange-700" : "text-slate-400"
                      }`}
                    >
                      {formatPriceXof(courier.toCashValue)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAllocateFor(courier)}
                          disabled={!courier.active}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <PackagePlus className="h-4 w-4" />
                          Remettre
                        </button>
                        <Link
                          href={`/application/livreurs/${courier.id}?${deliveryPeriodSearch(period)}`}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Détail
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
              Remis, livrés, rendus, livraisons et encaissé : sur la période. * Doit lui rester et
              à encaisser : situation actuelle.
            </p>
          </section>
        )}

        <DeliveryDailyTable daily={daily} />
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
