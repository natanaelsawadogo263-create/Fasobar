import type { CashierProduct } from "@/lib/orders/types";

export function normalizeStockKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Quantité caisse à partir des articles stock admin.
 * Boisson / magasin sans fiche stock (alors que le stock existe) = 0 = rupture.
 * Cuisine sans fiche stock = non suivi (plats vendables).
 */
export function resolveCashierStockQuantity(
  product: Pick<CashierProduct, "id" | "name" | "departmentCode">,
  qtyByProductId: Map<string, number>,
  qtyByName: Map<string, number>,
  hasStockCatalog: boolean,
): number | null {
  const byId = qtyByProductId.get(product.id);
  if (byId !== undefined) {
    return byId;
  }

  const byName = qtyByName.get(normalizeStockKey(product.name));
  if (byName !== undefined) {
    return byName;
  }

  if (hasStockCatalog && product.departmentCode !== "KITCHEN") {
    return 0;
  }

  return null;
}

/** Produit avec stock à 0 ou moins : non vendable en caisse. */
export function isProductOutOfStock(product: CashierProduct): boolean {
  return (
    typeof product.stockQuantity === "number" && product.stockQuantity <= 0
  );
}

export function isBarProductOutOfStock(product: CashierProduct): boolean {
  return isProductOutOfStock(product);
}
