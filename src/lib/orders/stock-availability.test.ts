import { describe, expect, it } from "vitest";

import {
  isProductOutOfStock,
  resolveCashierStockQuantity,
} from "@/lib/orders/stock-availability";
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

describe("isProductOutOfStock", () => {
  it("marque un produit à 0 comme rupture", () => {
    expect(isProductOutOfStock(product({ stockQuantity: 0 }))).toBe(true);
  });

  it("laisse vendre un produit encore en stock", () => {
    expect(isProductOutOfStock(product({ stockQuantity: 2 }))).toBe(false);
  });

  it("bloque un produit cuisine à 0", () => {
    expect(
      isProductOutOfStock(
        product({ departmentCode: "KITCHEN", stockQuantity: 0 }),
      ),
    ).toBe(true);
  });

  it("ignore un produit sans stock suivi", () => {
    expect(isProductOutOfStock(product({ stockQuantity: null }))).toBe(false);
    expect(isProductOutOfStock(product({}))).toBe(false);
  });
});

describe("resolveCashierStockQuantity", () => {
  it("relie par product_id", () => {
    const qtyByProductId = new Map([["p1", 4]]);
    expect(
      resolveCashierStockQuantity(product({}), qtyByProductId, new Map(), true),
    ).toBe(4);
  });

  it("relie par nom normalisé si product_id absent", () => {
    const qtyByName = new Map([["flag", 0]]);
    expect(
      resolveCashierStockQuantity(
        product({ name: "FLAG" }),
        new Map(),
        qtyByName,
        true,
      ),
    ).toBe(0);
  });

  it("marque une boisson sans fiche stock comme rupture", () => {
    expect(
      resolveCashierStockQuantity(product({}), new Map(), new Map(), true),
    ).toBe(0);
  });

  it("laisse un plat cuisine sans fiche stock vendable", () => {
    expect(
      resolveCashierStockQuantity(
        product({ departmentCode: "KITCHEN", name: "Riz sauce" }),
        new Map(),
        new Map(),
        true,
      ),
    ).toBeNull();
  });

  it("ne bloque pas tout le bar si aucun article stock n’a été chargé", () => {
    expect(
      resolveCashierStockQuantity(product({}), new Map(), new Map(), false),
    ).toBeNull();
  });
});
