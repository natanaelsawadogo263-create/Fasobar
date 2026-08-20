import { describe, expect, it } from "vitest";

import { unitCostFromSupplyLine } from "@/lib/profit/product-unit-cost";

describe("unitCostFromSupplyLine", () => {
  it("utilise le prix unitaire quand l’appro est à l’unité", () => {
    expect(
      unitCostFromSupplyLine({ purchasePrice: 700, conversionFactor: 1 }),
    ).toBe(700);
  });

  it("convertit le prix du carton en coût par unité stock", () => {
    // Carton à 12 000 F / 24 bouteilles → 500 F / bouteille
    expect(
      unitCostFromSupplyLine({ purchasePrice: 12_000, conversionFactor: 24 }),
    ).toBe(500);
  });

  it("ne prend jamais le total du bon d’appro (seulement le prix de la ligne produit)", () => {
    const unit = unitCostFromSupplyLine({
      purchasePrice: 12_000,
      conversionFactor: 24,
    });
    // 2 bouteilles vendues → coût 1000, pas 12 000
    expect(2 * unit).toBe(1000);
    expect(2 * unit).not.toBe(12_000);
  });
});
