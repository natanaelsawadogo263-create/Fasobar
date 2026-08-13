import type { KitchenStatus } from "@/lib/kitchen/schemas";
import type { OrderType } from "@/lib/orders/schemas";

export const KITCHEN_STATUS_LABELS: Record<KitchenStatus, string> = {
  TO_PREPARE: "À préparer",
  IN_PREPARATION: "En préparation",
  READY: "Prête",
  SERVED: "Servie",
};

export const KITCHEN_STATUS_BADGE: Record<KitchenStatus, string> = {
  TO_PREPARE: "bg-orange-50 text-orange-700",
  IN_PREPARATION: "bg-blue-50 text-blue-700",
  READY: "bg-emerald-50 text-emerald-700",
  SERVED: "bg-slate-100 text-slate-600",
};

export const KITCHEN_NEXT_ACTION: Record<
  KitchenStatus,
  { label: string; nextStatus: KitchenStatus | null }
> = {
  TO_PREPARE: { label: "Démarrer", nextStatus: "IN_PREPARATION" },
  IN_PREPARATION: { label: "Marquer prête", nextStatus: "READY" },
  READY: { label: "Servie", nextStatus: "SERVED" },
  SERVED: { label: "", nextStatus: null },
};

export const KITCHEN_COLUMNS: KitchenStatus[] = [
  "TO_PREPARE",
  "IN_PREPARATION",
  "READY",
  "SERVED",
];

export type KitchenOrderTicket = {
  id: string;
  orderNumber: number;
  tableReference: string | null;
  customerReference: string | null;
  orderType: OrderType;
  kitchenStatus: KitchenStatus;
  kitchenStatusUpdatedAt: string | null;
  createdAt: string;
  isSupplement: boolean;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    notes: string | null;
  }>;
};

export type KitchenActionState = {
  error?: string;
  success?: string;
};
