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

/** Vente au poids, volume ou mesure en caisse (détail / quantité décimale). */
export function inferFractionableFromUnit(unit: ProductUnit): boolean {
  return unit === "KG" || unit === "LITER" || unit === "TONNE" || unit === "METER";
}

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
  SAC: "Sac",
  JERRYCAN: "Bidon",
  CARTON: "Carton",
  BUNDLE: "Paquet",
  TONNE: "Tonne",
  METER: "Mètre",
  ROLL: "Rouleau",
  BARRE: "Barre",
  SHEET: "Feuille",
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

/** Magasin : pack, carton, paquet — pas de casier bar. */
export const SHOP_PACKAGING_UNITS: BarPackagingUnit[] = ["PACK", "CARTON", "BUNDLE"];

export const BAR_PACKAGING_LABELS: Record<BarPackagingUnit, string> = {
  CASE: "Casier",
  CARTON: "Carton",
  SACHET: "Sachet",
  PACK: "Pack",
  BUNDLE: "Paquet",
};

/** Valeurs par défaut du nombre d'exemplaires selon le format. */
export const BAR_PACKAGING_DEFAULT_UNITS: Record<BarPackagingUnit, number> = {
  CASE: 12,
  CARTON: 24,
  SACHET: 10,
  PACK: 20,
  BUNDLE: 10,
};

/** Défauts magasin : carton de 5 bidons, pack de 20 sachets. */
export const SHOP_PACKAGING_DEFAULT_UNITS: Record<
  (typeof SHOP_PACKAGING_UNITS)[number],
  number
> = {
  PACK: 20,
  CARTON: 5,
  BUNDLE: 10,
};

/** Suggestion de lot selon l’unité de vente (huile, eau sachet…). */
export function suggestedShopLot(unit: ProductUnit): {
  packagingUnit: BarPackagingUnit;
  unitsPerPack: number;
} | null {
  if (unit === "JERRYCAN") {
    return { packagingUnit: "CARTON", unitsPerPack: 5 };
  }
  if (unit === "SACHET") {
    return { packagingUnit: "PACK", unitsPerPack: 20 };
  }
  if (unit === "BOTTLE") {
    return { packagingUnit: "CARTON", unitsPerPack: 12 };
  }
  if (unit === "CAN") {
    return { packagingUnit: "CARTON", unitsPerPack: 24 };
  }
  return null;
}

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

export function formatProductUnitDisplay(
  unit: string,
  stockUnitLabel?: string | null,
): string {
  const custom = stockUnitLabel?.trim();
  if (custom) return custom;
  return PRODUCT_UNIT_LABELS[unit as ProductUnit] ?? unit;
}

export function formatPriceXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}
