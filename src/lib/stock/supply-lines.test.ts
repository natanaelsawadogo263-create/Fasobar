import { describe, expect, it } from "vitest";

import {
  buildSupplyLine,
  buildSupplyPurchaseModes,
  computeSupplyLineAmounts,
  resolveSupplyPurchaseMode,
  supplyReceiptTotal,
} from "@/lib/stock/supply-lines";

describe("approvisionnement multi-lignes", () => {
  it("ampoule : 4 cartons de 50 = +200 pièces", () => {
    const modes = buildSupplyPurchaseModes("pièce", [
      {
        id: "u",
        productId: "p",
        name: "pièce",
        packagingUnit: "pièce",
        baseUnit: "pièce",
        conversionFactor: 1,
        active: true,
      },
      {
        id: "c",
        productId: "p",
        name: "carton",
        packagingUnit: "carton",
        baseUnit: "pièce",
        conversionFactor: 50,
        active: true,
      },
    ]);
    const carton = modes.find((mode) => mode.kind === "pack");
    expect(carton?.factor).toBe(50);
    const amounts = computeSupplyLineAmounts({
      quantity: 4,
      factor: carton!.factor,
      purchasePrice: 45000,
    });
    expect(amounts.stockQuantity).toBe(200);
    expect(amounts.lineTotal).toBe(180000);
  });

  it("ciment : 20 sacs sans conversion = +20 sacs", () => {
    const modes = buildSupplyPurchaseModes("sac", []);
    expect(modes).toHaveLength(1);
    expect(modes[0]?.factor).toBe(1);
    const line = buildSupplyLine({
      stockItemId: "s",
      productId: "p",
      productName: "Ciment",
      stockUnit: "sac",
      mode: modes[0]!,
      quantity: 20,
      purchasePrice: 6500,
    });
    expect(line.stockQuantity).toBe(20);
    expect(line.lineTotal).toBe(130000);
  });

  it("câble : 10 rouleaux = +10 rouleaux", () => {
    const amounts = computeSupplyLineAmounts({
      quantity: 10,
      factor: 1,
      purchasePrice: 40000,
    });
    expect(amounts.stockQuantity).toBe(10);
  });

  it("réutilise le facteur du produit, pas une conversion à part", () => {
    const packagings = [
      {
        id: "u",
        productId: "p",
        name: "pièce",
        packagingUnit: "pièce",
        baseUnit: "pièce",
        conversionFactor: 1,
        active: true,
      },
      {
        id: "c",
        productId: "p",
        name: "carton",
        packagingUnit: "carton",
        baseUnit: "pièce",
        conversionFactor: 50,
        active: true,
      },
    ];
    const mode = resolveSupplyPurchaseMode("pièce", packagings, "c", "carton");
    expect(mode.factor).toBe(50);
    expect(computeSupplyLineAmounts({ quantity: 4, factor: mode.factor, purchasePrice: 1 }).stockQuantity).toBe(
      200,
    );
  });

  it("total général = somme des lignes", () => {
    expect(
      supplyReceiptTotal([
        { lineTotal: 180000 },
        { lineTotal: 130000 },
        { lineTotal: 400000 },
      ]),
    ).toBe(710000);
  });
});
