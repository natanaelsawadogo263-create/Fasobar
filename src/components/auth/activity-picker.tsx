"use client";

import {
  Bike,
  BrickWall,
  Car,
  Circle,
  CheckCircle2,
  MoreHorizontal,
  Pill,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  BUSINESS_ACTIVITIES,
  isSelectableActivityId,
  type BusinessActivityId,
} from "@/lib/auth/activities";

const ICONS: Record<(typeof BUSINESS_ACTIVITIES)[number]["icon"], LucideIcon> = {
  store: Store,
  shirt: Shirt,
  smartphone: Smartphone,
  pill: Pill,
  sparkles: Sparkles,
  bike: Bike,
  car: Car,
  truck: Truck,
  wrench: Wrench,
  brick: BrickWall,
  utensils: UtensilsCrossed,
  warehouse: Warehouse,
  more: MoreHorizontal,
};

type ActivityPickerProps = {
  name?: string;
  value: BusinessActivityId | "";
  onChange: (id: BusinessActivityId) => void;
};

export function ActivityPicker({
  name = "activityCode",
  value,
  onChange,
}: ActivityPickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {BUSINESS_ACTIVITIES.map((activity) => {
        const selected = value === activity.id;
        const available = isSelectableActivityId(activity.id);
        const Icon = ICONS[activity.icon];
        return (
          <label
            key={activity.id}
            aria-disabled={!available}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
              !available
                ? "pointer-events-none cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                : selected
                  ? "cursor-pointer border-emerald-500 bg-white ring-2 ring-emerald-500/20"
                  : "cursor-pointer border-slate-200 bg-white hover:border-emerald-300"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={activity.id}
              checked={selected}
              disabled={!available}
              onChange={() => {
                if (available) onChange(activity.id);
              }}
              className="sr-only"
            />
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                !available
                  ? "bg-slate-200 text-slate-500"
                  : selected
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="block text-[14px] font-semibold text-slate-900">
                  {activity.label}
                </span>
                {!available ? (
                  <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Bientôt
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                {activity.description}
              </span>
            </span>
            {available ? (
              selected ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-slate-300" />
              )
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
