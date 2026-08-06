"use client";

import type { BarPrepStatus } from "@/lib/bar/schemas";
import type { KitchenStatus } from "@/lib/kitchen/schemas";
import {
  SHARED_BAR_STATUS_LABELS,
  SHARED_BAR_STATUS_STYLES,
  SHARED_KITCHEN_STATUS_LABELS,
  SHARED_KITCHEN_STATUS_STYLES,
} from "@/lib/ops/prep-labels";

type OrderPrepBadgesProps = {
  barStatus?: string | null;
  kitchenStatus?: string | null;
  className?: string;
};

export function OrderPrepBadges({
  barStatus,
  kitchenStatus,
  className = "",
}: OrderPrepBadgesProps) {
  const bar = barStatus as BarPrepStatus | null | undefined;
  const kitchen = kitchenStatus as KitchenStatus | null | undefined;

  if (!bar && !kitchen) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {bar && bar in SHARED_BAR_STATUS_LABELS ? (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${SHARED_BAR_STATUS_STYLES[bar]}`}
        >
          {SHARED_BAR_STATUS_LABELS[bar]}
        </span>
      ) : null}
      {kitchen && kitchen in SHARED_KITCHEN_STATUS_LABELS ? (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${SHARED_KITCHEN_STATUS_STYLES[kitchen]}`}
        >
          {SHARED_KITCHEN_STATUS_LABELS[kitchen]}
        </span>
      ) : null}
    </div>
  );
}
