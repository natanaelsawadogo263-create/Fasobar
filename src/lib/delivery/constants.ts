import type {
  CourierStockMovementType,
  DeliveryOrderStatus,
} from "@/lib/delivery/types";

export const DELIVERY_ORDER_STATUS_LABELS: Record<DeliveryOrderStatus, string> = {
  PENDING: "En attente d’un livreur",
  ACCEPTED: "En cours de livraison",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export const DELIVERY_ORDER_STATUS_TONES: Record<
  DeliveryOrderStatus,
  "amber" | "sky" | "emerald" | "neutral"
> = {
  PENDING: "amber",
  ACCEPTED: "sky",
  DELIVERED: "emerald",
  CANCELLED: "neutral",
};

/** Étape affichée : « Livrée » se dédouble en « à encaisser » / « encaissée ». */
export type DeliveryOrderStage = "PENDING" | "ACCEPTED" | "TO_CASH" | "CASHED" | "CANCELLED";

export function deliveryOrderStage(order: {
  status: DeliveryOrderStatus;
  cashedAt: string | null;
}): DeliveryOrderStage {
  if (order.status === "DELIVERED") return order.cashedAt ? "CASHED" : "TO_CASH";
  return order.status;
}

export const DELIVERY_ORDER_STAGE_LABELS: Record<DeliveryOrderStage, string> = {
  PENDING: "En attente d’un livreur",
  ACCEPTED: "En cours de livraison",
  TO_CASH: "Livrée · à encaisser",
  CASHED: "Encaissée",
  CANCELLED: "Annulée",
};

export const DELIVERY_ORDER_STAGE_TONES: Record<
  DeliveryOrderStage,
  "amber" | "sky" | "orange" | "emerald" | "neutral"
> = {
  PENDING: "amber",
  ACCEPTED: "sky",
  TO_CASH: "orange",
  CASHED: "emerald",
  CANCELLED: "neutral",
};

export const COURIER_MOVEMENT_LABELS: Record<CourierStockMovementType, string> = {
  ALLOCATION: "Remise",
  RETURN: "Retour",
  DELIVERY: "Livraison",
};

/** « Savon » ou « Savon · Carton de 12 » quand la ligne est vendue en gros. */
export function formatDeliveryLineName(item: {
  productName: string;
  saleUnitName?: string | null;
}): string {
  return item.saleUnitName ? `${item.productName} · ${item.saleUnitName}` : item.productName;
}

export function formatDeliveryOrderNumber(orderNumber: number): string {
  return `L-${String(orderNumber).padStart(4, "0")}`;
}

export function formatDeliveryQuantity(quantity: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(quantity);
}

export const DELIVERY_PATHS = [
  "/application/livraisons",
  "/application/livreur",
  "/application/livreur/en-cours",
  "/application/livreur/historique",
  "/application/livreur/stock",
  "/application/livreurs",
] as const;

/** Historique des livraisons du livreur : périodes proposées (jours, aujourd'hui inclus). */
export const COURIER_HISTORY_PERIODS = [
  { id: "aujourdhui", label: "Aujourd’hui", days: 1 },
  { id: "7j", label: "7 jours", days: 7 },
  { id: "30j", label: "30 jours", days: 30 },
  { id: "90j", label: "90 jours", days: 90 },
] as const;

export type CourierHistoryPeriodId = (typeof COURIER_HISTORY_PERIODS)[number]["id"];

export const DEFAULT_COURIER_HISTORY_PERIOD: CourierHistoryPeriodId = "7j";

/** Nombre maximal de livraisons chargées dans l'historique. */
export const COURIER_HISTORY_LIMIT = 500;

export function parseCourierHistoryPeriod(value: unknown): CourierHistoryPeriodId {
  const match = COURIER_HISTORY_PERIODS.find((period) => period.id === value);
  return match?.id ?? DEFAULT_COURIER_HISTORY_PERIOD;
}

/** Début (minuit à Ouagadougou, UTC) de la période : aujourd'hui puis les jours précédents. */
export function courierHistoryStart(periodId: CourierHistoryPeriodId, now: Date = new Date()): Date {
  const period = COURIER_HISTORY_PERIODS.find((item) => item.id === periodId);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((period?.days ?? 7) - 1));
  return start;
}
