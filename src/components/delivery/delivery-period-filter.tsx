"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";

import {
  DELIVERY_PERIOD_PRESETS,
  deliveryPeriodSearch,
  formatDeliveryPeriodLabel,
  type DeliveryPeriod,
} from "@/lib/delivery/period";

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
  // Mobile : les champs « Du / Au » ne s'affichent qu'à la demande.
  const [showRange, setShowRange] = useState(period.preset === "personnalise");

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
          <button
            type="button"
            aria-expanded={showRange}
            onClick={() => setShowRange((current) => !current)}
            className={`inline-flex h-10 shrink-0 items-center rounded-lg px-3 text-[12px] font-semibold transition sm:hidden ${
              period.preset === "personnalise"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 active:bg-slate-200"
            }`}
          >
            Dates…
          </button>
        </div>

        <div
          className={`${showRange ? "grid" : "hidden"} grid-cols-2 gap-2 rounded-lg sm:flex sm:items-center sm:px-1 ${
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
