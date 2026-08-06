import type { BarPrepStatus } from "@/lib/bar/schemas";
import type { KitchenStatus } from "@/lib/kitchen/schemas";

/** Badges / libellés partagés (même vocabulaire dans tous les espaces). */
export const SHARED_BAR_STATUS_LABELS: Record<BarPrepStatus, string> = {
  TO_PREPARE: "Bar · à préparer",
  IN_PREPARATION: "Bar · en cours",
  READY: "Bar · prêt",
};

export const SHARED_KITCHEN_STATUS_LABELS: Record<KitchenStatus, string> = {
  TO_PREPARE: "Cuisine · à préparer",
  IN_PREPARATION: "Cuisine · en cours",
  READY: "Cuisine · prête",
  SERVED: "Cuisine · servie",
};

export const SHARED_BAR_STATUS_STYLES: Record<BarPrepStatus, string> = {
  TO_PREPARE: "bg-sky-50 text-sky-800 ring-sky-100",
  IN_PREPARATION: "bg-amber-50 text-amber-800 ring-amber-100",
  READY: "bg-emerald-50 text-emerald-800 ring-emerald-100",
};

export const SHARED_KITCHEN_STATUS_STYLES: Record<KitchenStatus, string> = {
  TO_PREPARE: "bg-orange-50 text-orange-800 ring-orange-100",
  IN_PREPARATION: "bg-blue-50 text-blue-800 ring-blue-100",
  READY: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  SERVED: "bg-slate-100 text-slate-600 ring-slate-200",
};
