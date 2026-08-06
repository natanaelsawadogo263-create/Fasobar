import {
  CAISSE_DEMO_CART,
  CAISSE_DEMO_TABLE,
  CAISSE_PRODUCTS,
} from "@/lib/caisse/catalog";
import type { CartLine, CashierProduct } from "@/lib/orders/types";

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findProduct(products: CashierProduct[], slug: string): CashierProduct | undefined {
  const catalog = CAISSE_PRODUCTS.find((item) => item.slug === slug);
  if (!catalog) {
    return undefined;
  }

  return products.find(
    (product) =>
      normalizeName(product.name) === normalizeName(catalog.name) ||
      product.name.toLowerCase().includes(catalog.slug.replace(/-/g, " ")),
  );
}

export function buildDemoCart(products: CashierProduct[]): CartLine[] {
  return CAISSE_DEMO_CART.flatMap(({ slug, quantity }) => {
    const product = findProduct(products, slug);
    if (!product) {
      return [];
    }

    return [
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.sellingPrice,
        quantity,
        departmentCode: product.departmentCode,
        departmentName: product.departmentName,
        categoryName: product.categoryName,
        unit: product.unit,
        available: true,
      },
    ];
  });
}

export function getDemoTableReference(): string {
  return CAISSE_DEMO_TABLE;
}

export function shouldUseDemoCart(_initialOrder?: { id: string } | null): boolean {
  // Désactivé en production : la caissière part d'un panier vide et crée la commande.
  void _initialOrder;
  return false;
}
