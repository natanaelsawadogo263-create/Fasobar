import { PRODUCT_UNIT_LABELS } from "@/lib/products/constants";
import type { ProductUnit } from "@/lib/products/schemas";

/** Unités présentes dès la première migration catalogue. */
export const CORE_PRODUCT_UNITS = [
  "BOTTLE",
  "CAN",
  "PORTION",
  "PIECE",
  "KG",
  "LITER",
  "PACK",
  "CASE",
] as const satisfies readonly ProductUnit[];

export function isProductUnitEnumError(
  error: { message?: string; code?: string } | null,
): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("invalid input value for enum") ||
    (message.includes("product_unit") &&
      (message.includes("enum") || message.includes("22p02")))
  );
}

export function productUnitDisplayLabel(unit: ProductUnit): string {
  return PRODUCT_UNIT_LABELS[unit] ?? unit;
}

export function persistProductUnit(
  unit: ProductUnit,
  options: { fallback?: boolean } = {},
): { unit: ProductUnit; stock_unit_label: string } {
  const stock_unit_label = productUnitDisplayLabel(unit);
  if (
    options.fallback &&
    !(CORE_PRODUCT_UNITS as readonly string[]).includes(unit)
  ) {
    return { unit: "PIECE", stock_unit_label };
  }
  return { unit, stock_unit_label };
}
