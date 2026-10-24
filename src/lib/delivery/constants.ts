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

export const COURIER_MOVEMENT_LABELS: Record<CourierStockMovementType, string> = {
  ALLOCATION: "Remise",
  RETURN: "Retour",
  DELIVERY: "Livraison",
};

export function formatDeliveryOrderNumber(orderNumber: number): string {
  return `L-${String(orderNumber).padStart(4, "0")}`;
}

export function formatDeliveryQuantity(quantity: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(quantity);
}

export const DELIVERY_PATHS = [
  "/application/livraisons",
  "/application/livreur",
  "/application/livreurs",
] as const;
