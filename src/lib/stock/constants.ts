import type { DepartmentCode } from "@/lib/products/schemas";
import { DEPARTMENT_LABELS, MANAGEMENT_ROLES, PRODUCT_UNIT_LABELS } from "@/lib/products/constants";
import type { LossMovementType, StockStatus, StockTab } from "@/lib/stock/schemas";

export { DEPARTMENT_LABELS, MANAGEMENT_ROLES, PRODUCT_UNIT_LABELS };

export const BAR_STOCK_ROLES = new Set(["BAR_MANAGER"]);
export const KITCHEN_STOCK_ROLES = new Set(["KITCHEN_MANAGER", "CASHIER_KITCHEN", "CASHIER"]);
export const STOCK_READ_ROLES = new Set(["CASHIER", "CASHIER_KITCHEN", "KITCHEN_MANAGER"]);

export const STOCK_TABS: Array<{ id: StockTab; label: string; href: string }> = [
  { id: "all", label: "Tous", href: "/application/stock" },
  { id: "bar", label: "Boissons", href: "/application/stock/boissons" },
  { id: "kitchen", label: "Cuisine", href: "/application/stock/cuisine" },
  { id: "alerts", label: "Alertes", href: "/application/stock?tab=alerts" },
];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: "OK",
  low: "Stock faible",
  out: "Rupture",
  inactive: "Inactif",
};

export const STOCK_STATUS_STYLES: Record<StockStatus, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  low: "bg-amber-50 text-amber-800",
  out: "bg-red-50 text-red-700",
  inactive: "bg-slate-100 text-slate-600",
};

export const LOSS_TYPE_LABELS: Record<LossMovementType, string> = {
  LOSS: "Perte",
  BREAKAGE: "Casse",
  STAFF_CONSUMPTION: "Consommation personnel",
  GIFT: "Offert / cadeau",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Achat",
  MANUAL_ENTRY: "Entrée manuelle",
  SALE: "Vente",
  LOSS: "Perte",
  BREAKAGE: "Casse",
  STAFF_CONSUMPTION: "Consommation personnel",
  GIFT: "Offert",
  INVENTORY_ADJUSTMENT: "Correction inventaire",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
};

export const PURCHASE_UNIT_PRESETS: Record<
  string,
  { purchaseUnit: string; stockUnit: string; factor: number; label: string; departments: Array<"BAR" | "KITCHEN"> }
> = {
  CASE_BOTTLE: {
    purchaseUnit: "CASE",
    stockUnit: "BOTTLE",
    factor: 24,
    label: "Casier → bouteilles (×24)",
    departments: ["BAR"],
  },
  PACK_PIECE: {
    purchaseUnit: "PACK",
    stockUnit: "PIECE",
    factor: 6,
    label: "Pack → unités (×6)",
    departments: ["BAR", "KITCHEN"],
  },
  SAC_KG: {
    purchaseUnit: "PIECE",
    stockUnit: "KG",
    factor: 25,
    label: "Sac → kilogrammes (×25)",
    departments: ["KITCHEN"],
  },
  SAC_50_KG: {
    purchaseUnit: "PIECE",
    stockUnit: "KG",
    factor: 50,
    label: "Sac → kilogrammes (×50)",
    departments: ["KITCHEN"],
  },
  BIDON_LITER: {
    purchaseUnit: "PIECE",
    stockUnit: "LITER",
    factor: 20,
    label: "Bidon → litres (×20)",
    departments: ["KITCHEN"],
  },
  BIDON_5_LITER: {
    purchaseUnit: "PIECE",
    stockUnit: "LITER",
    factor: 5,
    label: "Bidon → litres (×5)",
    departments: ["KITCHEN"],
  },
};

/** Suggestions d'articles cuisine = matières premières (pas des plats). */
export const KITCHEN_INGREDIENT_SUGGESTIONS: Array<{
  name: string;
  unit: keyof typeof PRODUCT_UNIT_LABELS;
}> = [
  { name: "Riz (sac)", unit: "KG" },
  { name: "Huile de cuisine", unit: "LITER" },
  { name: "Oignons", unit: "KG" },
  { name: "Tomates", unit: "KG" },
  { name: "Poulet cru", unit: "KG" },
  { name: "Poisson frais", unit: "KG" },
  { name: "Attiéké (base)", unit: "KG" },
  { name: "Farine", unit: "KG" },
  { name: "Sel", unit: "KG" },
  { name: "Sucre", unit: "KG" },
  { name: "Épices / condiments", unit: "KG" },
  { name: "Gaz / combustible cuisine", unit: "PIECE" },
];

export function getPurchasePresetsForDepartment(departmentCode: "BAR" | "KITCHEN" | string) {
  return Object.entries(PURCHASE_UNIT_PRESETS).filter(([, preset]) =>
    preset.departments.includes(departmentCode as "BAR" | "KITCHEN"),
  );
}

export function canManageDepartmentStock(
  organizationRole: string,
  establishmentRole: string,
  departmentCode: DepartmentCode,
): boolean {
  if (MANAGEMENT_ROLES.has(organizationRole) || MANAGEMENT_ROLES.has(establishmentRole)) {
    return true;
  }

  if (departmentCode === "BAR") {
    return (
      BAR_STOCK_ROLES.has(organizationRole) || BAR_STOCK_ROLES.has(establishmentRole)
    );
  }

  return (
    KITCHEN_STOCK_ROLES.has(organizationRole) ||
    KITCHEN_STOCK_ROLES.has(establishmentRole)
  );
}

export function resolveStockPermissions(
  organizationRole: string,
  establishmentRole: string,
) {
  const canManageBarStock = canManageDepartmentStock(
    organizationRole,
    establishmentRole,
    "BAR",
  );
  const canManageKitchenStock = canManageDepartmentStock(
    organizationRole,
    establishmentRole,
    "KITCHEN",
  );
  const canManageStock = canManageBarStock || canManageKitchenStock;
  const canReadStock =
    canManageStock ||
    STOCK_READ_ROLES.has(organizationRole) ||
    STOCK_READ_ROLES.has(establishmentRole);

  return {
    canManageStock,
    canManageBarStock,
    canManageKitchenStock,
    canReadStock,
  };
}

export function computeStockStatus(
  currentQuantity: number,
  minimumQuantity: number,
  active: boolean,
): StockStatus {
  if (!active) {
    return "inactive";
  }

  if (currentQuantity <= 0) {
    return "out";
  }

  if (currentQuantity <= minimumQuantity) {
    return "low";
  }

  return "ok";
}

export function formatQuantity(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
  }).format(value);

  if (!unit) {
    return formatted;
  }

  const unitLabel =
    PRODUCT_UNIT_LABELS[unit as keyof typeof PRODUCT_UNIT_LABELS] ?? unit;

  return `${formatted} ${unitLabel.toLowerCase()}${value > 1 ? "s" : ""}`;
}

export function formatPriceXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}
