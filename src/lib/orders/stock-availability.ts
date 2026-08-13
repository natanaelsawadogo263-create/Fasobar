import type { CashierProduct } from "@/lib/orders/types";

/** Produit bar sans quantité restante : non vendable en caisse. */
export function isBarProductOutOfStock(product: CashierProduct): boolean {
  return (
    product.departmentCode === "BAR" &&
    typeof product.stockQuantity === "number" &&
    product.stockQuantity <= 0
  );
}
