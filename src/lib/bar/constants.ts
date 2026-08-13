import type { BarPrepStatus } from "@/lib/bar/schemas";
import type { OrderType } from "@/lib/orders/schemas";

export const BAR_STATUS_LABELS: Record<BarPrepStatus, string> = {
  TO_PREPARE: "À préparer",
  IN_PREPARATION: "En préparation",
  READY: "Prêtes",
};

export const BAR_NEXT_ACTION: Record<
  BarPrepStatus,
  { label: string; nextStatus: BarPrepStatus | null }
> = {
  TO_PREPARE: { label: "Démarrer", nextStatus: "IN_PREPARATION" },
  IN_PREPARATION: { label: "Marquer prête", nextStatus: "READY" },
  READY: { label: "Voir détail", nextStatus: null },
};

export const BAR_BOARD_COLUMNS: BarPrepStatus[] = [
  "TO_PREPARE",
  "IN_PREPARATION",
  "READY",
];

export const BAR_HISTORY_TYPE_LABELS = {
  entry: "Entrée",
  loss: "Perte",
  inventory: "Inventaire",
  correction: "Correction",
} as const;

export type BarOrderTicket = {
  id: string;
  orderNumber: number;
  tableReference: string | null;
  customerReference: string | null;
  orderType: OrderType;
  status: string;
  paymentStatus: string;
  barStatus: BarPrepStatus;
  barStatusUpdatedAt: string | null;
  kitchenStatus: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  /** True si ce ticket n’est que le complément (commande déjà servie). */
  isSupplement: boolean;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes: string | null;
  }>;
};

export type BarHistoryRow = {
  id: string;
  createdAt: string;
  stockItemId: string;
  productName: string;
  unit: string;
  displayType: "entry" | "loss" | "inventory" | "correction";
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  reference: string | null;
  authorName: string | null;
};

export type BarActionState = {
  error?: string;
  success?: string;
};

export function formatBarOrderNumber(orderNumber: number): string {
  return `CMD-${orderNumber}`;
}

export function formatBarAge(iso: string): string {
  const minutes = Math.max(
    Math.floor((Date.now() - new Date(iso).getTime()) / 60_000),
    0,
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export function mapMovementToBarHistoryType(
  type: string,
): BarHistoryRow["displayType"] {
  if (type === "PURCHASE" || type === "MANUAL_ENTRY" || type === "TRANSFER_IN") {
    return "entry";
  }
  if (
    type === "LOSS" ||
    type === "BREAKAGE" ||
    type === "STAFF_CONSUMPTION" ||
    type === "GIFT"
  ) {
    return "loss";
  }
  if (type === "INVENTORY_ADJUSTMENT") {
    return "inventory";
  }
  return "correction";
}
