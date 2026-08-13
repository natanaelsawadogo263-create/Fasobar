import { describe, expect, it } from "vitest";

import { isBarProductOutOfStock } from "@/lib/orders/stock-availability";
import type { CashierProduct } from "@/lib/orders/types";

function product(overrides: Partial<CashierProduct>): CashierProduct {
  return {
    id: "p1",
    name: "Flag",
    sellingPrice: 1000,
    unit: "BOTTLE",
    imageUrl: null,
    departmentCode: "BAR",
    departmentName: "Bar",
    categoryId: "c1",
    categoryName: "Bières",
    ...overrides,
  };
}

describe("isBarProductOutOfStock", () => {
  it("marque un produit bar à 0 comme rupture", () => {
    expect(isBarProductOutOfStock(product({ stockQuantity: 0 }))).toBe(true);
  });

  it("laisse vendre un produit bar encore en stock", () => {
    expect(isBarProductOutOfStock(product({ stockQuantity: 2 }))).toBe(false);
  });

  it("n’applique pas la rupture à la cuisine", () => {
    expect(
      isBarProductOutOfStock(
        product({ departmentCode: "KITCHEN", stockQuantity: 0 }),
      ),
    ).toBe(false);
  });

  it("ignore un produit bar sans stock suivi", () => {
    expect(isBarProductOutOfStock(product({ stockQuantity: null }))).toBe(false);
    expect(isBarProductOutOfStock(product({}))).toBe(false);
  });
});
