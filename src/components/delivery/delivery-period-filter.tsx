"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";

import { formatPriceXof } from "@/lib/products/constants";
import {
  DELIVERY_PERIOD_PRESETS,
  deliveryPeriodSearch,
  formatDeliveryPeriodLabel,
  type DeliveryPeriod,
} from "@/lib/delivery/period";
import type { DeliveryDailyTotal } from "@/lib/delivery/types";

export type DeliveryPeriodValue = Pick<DeliveryPeriod, "preset" | "from" | "to">;

type DeliveryPeriodFilterProps = {
  period: DeliveryPeriodValue;
  /** Page à recharger avec la nouvelle période (ex. /application/livreurs). */
  basePath: string;
};

const dateInput =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-800 outline-none focus:border-emerald-500 sm:h-8 sm:w-auto sm:rounded-md sm:px-2 sm:text-[12px]";

/** Filtre de période : aujourd'hui, semaine, mois ou plage « du … au … ». */
export function DeliveryPeriodFilter({ period, basePath }: DeliveryPeriodFilterProps) {
  const router = useRouter();
  const [isLoading, startTransition] = useTransition();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  // Champs resynchronisés quand la période change (préréglage, navigation).
  const [syncedKey, setSyncedKey] = useState(`${period.from}|${period.to}`);
  if (syncedKey !== `${period.from}|${period.to}`) {
    setSyncedKey(`${period.from}|${period.to}`);
    setFrom(period.from);
    setTo(period.to);
  }

  function navigate(next: DeliveryPeriodValue) {
    startTransition(() => {
      router.replace(`${basePath}?${deliveryPeriodSearch(next)}`, { scroll: false });
    });
  }

  function applyRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (!nextFrom || !nextTo) return;
    navigate({ preset: "personnalise", from: nextFrom, to: nextTo });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="inline-flex items-center gap-1.5 px-1 text-[12px] font-semibold text-slate-700">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        ) : (
          <CalendarRange className="h-4 w-4 text-emerald-600" />
        )}
        {formatDeliveryPeriodLabel(period)}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:pb-0" role="radiogroup" aria-label="Période">
          {DELIVERY_PERIOD_PRESETS.map((preset) => {
            const active = period.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => navigate({ preset: preset.id, from: "", to: "" })}
                disabled={isLoading}
                className={`inline-flex h-10 shrink-0 items-center rounded-lg px-3 text-[12px] font-semibold transition disabled:opacity-60 sm:h-8 sm:rounded-md sm:px-2.5 ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 active:bg-slate-200 sm:hover:bg-slate-200"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div
          className={`grid grid-cols-2 gap-2 rounded-lg sm:flex sm:items-center sm:px-1 ${
            period.preset === "personnalise" ? "sm:bg-emerald-50 sm:py-0.5" : ""
          }`}
        >
          <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500 sm:flex-row sm:items-center sm:gap-1.5">
            Du
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => applyRange(event.target.value, to)}
              className={dateInput}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500 sm:flex-row sm:items-center sm:gap-1.5">
            Au
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => applyRange(from, event.target.value)}
              className={dateInput}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function formatDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Livraisons et chiffre d'affaires jour par jour sur la période. */
export function DeliveryDailyTable({ daily }: { daily: DeliveryDailyTotal[] }) {
  const totalDeliveries = daily.reduce((sum, day) => sum + day.deliveries, 0);
  const totalValue = daily.reduce((sum, day) => sum + day.value, 0);
  const maxValue = Math.max(...daily.map((day) => day.value), 1);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-[14px] font-bold text-slate-900">Chiffre d’affaires par jour</h2>
        <p className="text-[11px] text-slate-500">Livraisons finalisées sur la période sélectionnée.</p>
      </header>
      {daily.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-slate-500">
          Aucune livraison finalisée sur cette période.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Jour</th>
                <th className="px-3 py-2 text-right font-semibold">Livraisons</th>
                <th className="px-4 py-2 text-right font-semibold">Chiffre d’affaires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daily.map((day) => (
                <tr key={day.date}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-800">
                    {formatDayLabel(day.date)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{day.deliveries}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-3">
                      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <span
                          className="block h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max((day.value / maxValue) * 100, 2)}%` }}
                        />
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {formatPriceXof(day.value)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-bold">
              <tr>
                <td className="px-4 py-2.5 text-slate-700">Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{totalDeliveries}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                  {formatPriceXof(totalValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
