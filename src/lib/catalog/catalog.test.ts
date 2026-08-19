import { describe, expect, it } from "vitest";

import { buildCashierSaleChoices } from "@/lib/catalog/sale-choices";
import { applySaleStockDebits, snapshotSaleLine, stockQtyFromAmount } from "@/lib/catalog/sale-stock";
import { saleTypeDefaults, saleTypeOf } from "@/lib/catalog/sale-types";
import { mapLabelToProductUnit } from "@/lib/catalog/stock-unit";
import { toStockQuantity } from "@/lib/hardware/product-engine";

describe("socle commerce unités", () => {
  it("applique le type de vente au stock", () => {
    expect(saleTypeOf("WEIGHT")).toBe("WEIGHT");
    expect(saleTypeDefaults("LENGTH").stockUnit).toBe("mètre");
    expect(saleTypeDefaults("WEIGHT").fractionable).toBe(true);
  });

  it("ne confond pas sac et sachet", () => {
    expect(mapLabelToProductUnit("sac")).toBe("SAC");
    expect(mapLabelToProductUnit("Sacs")).toBe("SAC");
    expect(mapLabelToProductUnit("sachet")).toBe("SACHET");
  });

  it("garde la même règle achat et vente", () => {
    expect(toStockQuantity(1, 50)).toBe(50);
    expect(toStockQuantity(3.5, 1)).toBe(3.5);
  });

  it("vente unité : 1 pièce retire 1 du stock", () => {
    const line = snapshotSaleLine({
      productId: "ampoule",
      saleUnitName: "pièce",
      unitPrice: 1000,
      quantity: 1,
      conversionFactor: 1,
    });
    expect(line.stockQuantity).toBe(1);
    const result = applySaleStockDebits(new Map([["ampoule", 10]]), [line]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ledger.get("ampoule")).toBe(9);
  });

  it("vente gros : 1 carton de 50 retire 50 pièces", () => {
    expect(toStockQuantity(1, 50)).toBe(50);
    const line = snapshotSaleLine({
      productId: "ampoule",
      saleUnitName: "carton",
      unitPrice: 45000,
      quantity: 1,
      conversionFactor: 50,
    });
    const result = applySaleStockDebits(new Map([["ampoule", 200]]), [line]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ledger.get("ampoule")).toBe(150);
  });

  it("vente détail : montant / prix = quantité stock", () => {
    expect(stockQtyFromAmount(500, 2000)).toBe(0.25);
    expect(stockQtyFromAmount(750, 2000)).toBe(0.375);
    expect(stockQtyFromAmount(10000, 40000)).toBe(0.25);
    const qty = stockQtyFromAmount(500, 2000);
    const line = snapshotSaleLine({
      productId: "clous",
      saleUnitName: "kg",
      unitPrice: 2000,
      quantity: qty,
      conversionFactor: 1,
    });
    expect(line.stockQuantity).toBe(0.25);
    const result = applySaleStockDebits(new Map([["clous", 10]]), [line]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ledger.get("clous")).toBe(9.75);
  });

  it("approvisionnement unité : 10 rouleaux = +10", () => {
    expect(toStockQuantity(10, 1)).toBe(10);
  });

  it("approvisionnement gros : 4 cartons × 50 = +200", () => {
    expect(toStockQuantity(4, 50)).toBe(200);
  });

  it("propose Unité et Lot pour le supermarché", () => {
    const choices = buildCashierSaleChoices(
      {
        sellingPrice: 4500,
        unit: "bidon",
        saleUnits: [
          { id: "u", name: "bidon", price: 4500, factor: 1 },
          { id: "l", name: "carton", price: 20000, factor: 5 },
        ],
      },
      { shopLots: true },
    );
    expect(choices.map((item) => item.kind)).toEqual(["unit", "pack"]);
    expect(choices[1]?.title).toContain("Lot · carton de 5");
  });

  it("propose Unité et Gros à la caisse", () => {
    const choices = buildCashierSaleChoices({
      sellingPrice: 1000,
      unit: "pièce",
      saleUnits: [
        { id: "p", name: "pièce", price: 1000, factor: 1 },
        { id: "c", name: "carton", price: 45000, factor: 50 },
      ],
    });
    expect(choices.map((item) => item.kind)).toEqual(["unit", "pack"]);
    expect(choices[1]?.title).toContain("carton de 50");
  });

  it("propose Détail seulement si l’admin l’autorise", () => {
    const without = buildCashierSaleChoices({
      sellingPrice: 2000,
      unit: "kg",
      fractionable: false,
      saleUnits: [{ id: "kg", name: "kg", price: 2000, factor: 1 }],
    });
    expect(without.some((item) => item.kind === "detail")).toBe(false);

    const withDetail = buildCashierSaleChoices({
      sellingPrice: 2000,
      unit: "kg",
      fractionable: true,
      saleUnits: [{ id: "kg", name: "kg", price: 2000, factor: 1 }],
    });
    expect(withDetail.map((item) => item.kind)).toEqual(["unit", "detail"]);
  });
});
