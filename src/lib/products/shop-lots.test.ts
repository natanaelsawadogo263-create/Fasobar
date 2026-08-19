import { describe, expect, it } from "vitest";

import { suggestedShopLot } from "@/lib/products/constants";

describe("lots magasin", () => {
  it("propose un carton de 5 bidons pour l’huile", () => {
    expect(suggestedShopLot("JERRYCAN")).toEqual({
      packagingUnit: "CARTON",
      unitsPerPack: 5,
    });
  });

  it("propose un pack de 20 sachets pour l’eau", () => {
    expect(suggestedShopLot("SACHET")).toEqual({
      packagingUnit: "PACK",
      unitsPerPack: 20,
    });
  });

  it("ne force pas de lot pour le riz au sac", () => {
    expect(suggestedShopLot("SAC")).toBeNull();
    expect(suggestedShopLot("PIECE")).toBeNull();
    expect(suggestedShopLot("KG")).toBeNull();
  });
});
