import {
  isBusinessActivityId,
  isFoodServiceActivity,
  type BusinessActivityId,
} from "@/lib/auth/activities";

/** Magasins : tout sauf restauration / maquis / bar. */
export function isRetailShopOps(
  activityCode: string | null | undefined,
): boolean {
  return isBusinessActivityId(activityCode) && !isFoodServiceActivity(activityCode);
}

/**
 * Dépôt / pièces / gros : un SKU, conversions Unité / Gros / Détail,
 * wizard catalogue (comme la quincaillerie).
 */
export const TRADE_CATALOG_IDS = [
  "hardware",
  "construction",
  "moto-parts",
  "auto-parts",
  "wholesale",
] as const satisfies readonly BusinessActivityId[];

export type TradeCatalogId = (typeof TRADE_CATALOG_IDS)[number];

export function usesTradeCatalog(
  activityCode: string | null | undefined,
): boolean {
  return (
    typeof activityCode === "string" &&
    (TRADE_CATALOG_IDS as readonly string[]).includes(activityCode)
  );
}

/** Boutique / officine / téléphonie : fiche article simple. */
export function usesShopCatalog(
  activityCode: string | null | undefined,
): boolean {
  return isRetailShopOps(activityCode) && !usesTradeCatalog(activityCode);
}

export function isRetailAdminDirectSeller(actor: {
  activityCode?: string | null;
  userSpace?: string | null;
}): boolean {
  return isRetailShopOps(actor.activityCode) && actor.userSpace === "admin";
}
