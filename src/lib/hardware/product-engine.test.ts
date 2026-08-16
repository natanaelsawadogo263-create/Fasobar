import { describe, expect, it } from "vitest";

import {
  formatConversionLabel,
  toBaseFactor,
  toStockQuantity,
  validatePackagingGraph,
} from "@/lib/hardware/product-engine";

describe("conversions multiniveaux quincaillerie", () => {
  it("calcule carton = 2000 pièces (boîte × carton)", () => {
    const nodes = [
      { id: "piece", name: "pièce", parentId: null, containsQty: 1 },
      { id: "box", name: "boîte", parentId: "piece", containsQty: 100 },
      { id: "carton", name: "carton", parentId: "box", containsQty: 20 },
    ];
    const result = toBaseFactor(nodes, "carton");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.factor).toBe(2000);
    expect(formatConversionLabel(nodes, "carton")).toContain("2000");
  });

  it("calcule carton câble = 500 mètres", () => {
    const nodes = [
      { id: "m", name: "mètre", parentId: null, containsQty: 1 },
      { id: "roll", name: "rouleau", parentId: "m", containsQty: 100 },
      { id: "carton", name: "carton", parentId: "roll", containsQty: 5 },
    ];
    const result = toBaseFactor(nodes, "carton");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.factor).toBe(500);
  });

  it("refuse une conversion circulaire", () => {
    const nodes = [
      { id: "a", name: "a", parentId: "b", containsQty: 2 },
      { id: "b", name: "b", parentId: "a", containsQty: 2 },
    ];
    const result = validatePackagingGraph(nodes);
    expect(result.ok).toBe(false);
  });

  it("refuse quantité nulle", () => {
    const nodes = [
      { id: "piece", name: "pièce", parentId: null, containsQty: 1 },
      { id: "box", name: "boîte", parentId: "piece", containsQty: 0 },
    ];
    const result = validatePackagingGraph(nodes);
    expect(result.ok).toBe(false);
  });

  it("refuse une unité qui se contient elle-même", () => {
    const nodes = [
      { id: "x", name: "x", parentId: "x", containsQty: 1 },
    ];
    const result = toBaseFactor(nodes, "x");
    expect(result.ok).toBe(false);
  });

  it("convertit quantité achetée ou vendue vers le stock", () => {
    expect(toStockQuantity(10, 100)).toBe(1000);
    expect(toStockQuantity(2, 50)).toBe(100);
    expect(toStockQuantity(0.5, 1)).toBe(0.5);
  });
});
