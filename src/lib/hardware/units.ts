import type { ProductUnit } from "@/lib/products/schemas";

/** Convertit une quantité d’achat/vente vers l’unité de stock de base. */
export function toBaseStockQuantity(
  quantity: number,
  unitsPerPackage: number,
): number {
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  const factor =
    Number.isFinite(unitsPerPackage) && unitsPerPackage > 0
      ? unitsPerPackage
      : 1;
  return quantity * factor;
}

/** Convertit une quantité en unité de base vers un conditionnement. */
export function fromBaseStockQuantity(
  baseQuantity: number,
  unitsPerPackage: number,
): number {
  const factor =
    Number.isFinite(unitsPerPackage) && unitsPerPackage > 0
      ? unitsPerPackage
      : 1;
  if (!Number.isFinite(baseQuantity) || factor <= 0) return 0;
  return baseQuantity / factor;
}

export function canFulfillSale(availableBase: number, requestedBase: number): boolean {
  if (!Number.isFinite(availableBase) || !Number.isFinite(requestedBase)) {
    return false;
  }
  if (requestedBase <= 0) return false;
  return availableBase >= requestedBase;
}

export const HARDWARE_UNITS: ProductUnit[] = [
  "PIECE",
  "PACK",
  "CARTON",
  "BUNDLE",
  "SACHET",
  "SAC",
  "KG",
  "TONNE",
  "METER",
  "ROLL",
  "LITER",
  "JERRYCAN",
  "BARRE",
  "SHEET",
  "CASE",
];
