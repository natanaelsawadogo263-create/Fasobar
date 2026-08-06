import { CAISSE_PRODUCTS } from "@/lib/caisse/catalog";
import type { CashierProduct } from "@/lib/orders/types";

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Tri d'affichage caisse : produits connus du catalogue de référence en premier,
 * puis le reste par nom. Ne filtre plus — tout produit actif admin doit apparaître.
 */
export function sortCaisseProducts(products: CashierProduct[]): CashierProduct[] {
  const order = new Map(CAISSE_PRODUCTS.map((product, index) => [product.slug, index]));

  return [...products].sort((left, right) => {
    const leftIndex =
      order.get(left.name.toLowerCase().replace(/\s+/g, "-")) ??
      CAISSE_PRODUCTS.findIndex(
        (item) => normalizeName(item.name) === normalizeName(left.name),
      );
    const rightIndex =
      order.get(right.name.toLowerCase().replace(/\s+/g, "-")) ??
      CAISSE_PRODUCTS.findIndex(
        (item) => normalizeName(item.name) === normalizeName(right.name),
      );

    const safeLeft = leftIndex >= 0 ? leftIndex : 999;
    const safeRight = rightIndex >= 0 ? rightIndex : 999;

    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }

    return left.name.localeCompare(right.name, "fr");
  });
}
