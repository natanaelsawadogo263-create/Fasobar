import type { DepartmentCode } from "@/lib/products/schemas";
import { MANAGEMENT_ROLES } from "@/lib/products/constants";
import type { OrderStatus, OrderType } from "@/lib/orders/schemas";

export { MANAGEMENT_ROLES };
export { formatPriceXof } from "@/lib/products/constants";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  ON_SITE: "Sur place",
  TAKEAWAY: "À emporter",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "En attente",
  OPEN: "Ouverte",
  READY_TO_PAY: "À encaisser",
  CANCELLED: "Annulée",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  OPEN: "bg-emerald-50 text-emerald-700",
  READY_TO_PAY: "bg-amber-50 text-amber-800",
  CANCELLED: "bg-red-50 text-red-700",
};

export const ORDER_PAYMENT_STATUS_LABELS = {
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Terminée",
} as const;

export const ORDER_PAYMENT_STATUS_STYLES = {
  UNPAID: "bg-slate-100 text-slate-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-800",
  PAID: "bg-emerald-50 text-emerald-800",
} as const;

export const DEPARTMENT_FILTER_TABS = [
  { id: "all" as const, label: "Tous" },
  { id: "bar" as const, label: "Boissons" },
  { id: "kitchen" as const, label: "Nourriture" },
];

export const DEPARTMENT_BADGE_STYLES: Record<DepartmentCode, string> = {
  BAR: "bg-sky-50 text-sky-800 border-sky-100",
  KITCHEN: "bg-orange-50 text-orange-800 border-orange-100",
};

export const CASHIER_ROLES = new Set(["CASHIER", "CASHIER_KITCHEN", "KITCHEN_MANAGER"]);

export function resolveOrderPermissions(
  organizationRole: string,
  establishmentRole: string,
) {
  const canManageOrders =
    MANAGEMENT_ROLES.has(organizationRole) ||
    MANAGEMENT_ROLES.has(establishmentRole) ||
    CASHIER_ROLES.has(organizationRole) ||
    CASHIER_ROLES.has(establishmentRole);

  const canReadDepartmentOrders =
    organizationRole === "BAR_MANAGER" ||
    establishmentRole === "BAR_MANAGER" ||
    organizationRole === "KITCHEN_MANAGER" ||
    establishmentRole === "KITCHEN_MANAGER";

  const canReadOrders = canManageOrders || canReadDepartmentOrders;

  return { canManageOrders, canReadOrders };
}

export function formatOrderNumber(orderNumber: number): string {
  return `#${String(orderNumber).padStart(4, "0")}`;
}
