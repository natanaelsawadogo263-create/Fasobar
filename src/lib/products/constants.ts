import type {
  BarPackagingUnit,
  DepartmentCode,
  ProductTab,
  ProductUnit,
} from "@/lib/products/schemas";

export const DEPARTMENT_LABELS: Record<DepartmentCode, string> = {
  BAR: "Boissons",
  KITCHEN: "Nourriture",
};

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  BOTTLE: "Bouteille",
  CAN: "Canette",
  PORTION: "Portion",
  PIECE: "Pièce",
  KG: "Kilogramme",
  LITER: "Litre",
  PACK: "Pack",
  CASE: "Casier",
  SACHET: "Sachet",
  JERRYCAN: "Bidon",
  CARTON: "Carton",
  BUNDLE: "Paquet",
};

/** Unités de stock / vente pour les boissons (exemplaires individuels). */
export const BAR_BASE_UNITS = [
  "BOTTLE",
  "CAN",
  "JERRYCAN",
  "SACHET",
] as const satisfies readonly ProductUnit[];

export type BarBaseUnit = (typeof BAR_BASE_UNITS)[number];

export const BAR_BASE_UNIT_HINTS: Record<BarBaseUnit, string> = {
  BOTTLE: "Bière, soda en verre ou plastique",
  CAN: "Boisson en canette",
  JERRYCAN: "Eau, jus ou spiritueux en bidon",
  SACHET: "Eau ou boisson en sachet",
};

/** Formats d'achat : casier, carton ou sachet. */
export const BAR_PACKAGING_UNITS: BarPackagingUnit[] = ["CASE", "CARTON", "SACHET"];

export const BAR_PACKAGING_LABELS: Record<BarPackagingUnit, string> = {
  CASE: "Casier",
  CARTON: "Carton",
  SACHET: "Sachet",
};

/** Valeurs par défaut du nombre d'exemplaires selon le format. */
export const BAR_PACKAGING_DEFAULT_UNITS: Record<BarPackagingUnit, number> = {
  CASE: 12,
  CARTON: 24,
  SACHET: 10,
};

export const PRODUCT_TABS: Array<{ id: ProductTab; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "bar", label: "Boissons" },
  { id: "kitchen", label: "Nourriture" },
  { id: "unavailable", label: "Indisponibles" },
];

export const PRODUCT_UNITS = Object.keys(PRODUCT_UNIT_LABELS) as ProductUnit[];

export function packagingDisplayName(unit: BarPackagingUnit): string {
  return BAR_PACKAGING_LABELS[unit].toLowerCase();
}

export const MANAGEMENT_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);

export function formatPriceXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}
