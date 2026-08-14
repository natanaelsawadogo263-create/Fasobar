import { describe, expect, it } from "vitest";

import {
  getCatalogFormProfile,
  shouldShowCatalogCategory,
} from "@/lib/activity/catalog";

describe("catalogue produit par activité", () => {
  it("conserve le formulaire restauration", () => {
    const catalog = getCatalogFormProfile("restaurant");
    expect(catalog.kind).toBe("food");
    expect(catalog.showPackaging).toBe(true);
    expect(catalog.defaultUnit).toBe("BOTTLE");
    expect(catalog.namePlaceholder).toContain("Flag");
  });

  it("organise la pharmacie sans casier ni département bar", () => {
    const catalog = getCatalogFormProfile("pharmacy");
    expect(catalog.kind).toBe("retail");
    expect(catalog.hideDepartment).toBe(true);
    expect(catalog.showPackaging).toBe(false);
    expect(catalog.defaultUnit).toBe("PIECE");
    expect(catalog.suggestedCategories).toContain("Médicaments");
    expect(catalog.units).toContain("PIECE");
  });

  it("masque les catégories resto dans une boutique", () => {
    const catalog = getCatalogFormProfile("clothing");
    expect(shouldShowCatalogCategory("Bières", catalog)).toBe(false);
    expect(shouldShowCatalogCategory("Homme", catalog)).toBe(true);
    expect(shouldShowCatalogCategory("Accessoires", catalog)).toBe(true);
  });

  it("prépare le catalogue quincaillerie", () => {
    const catalog = getCatalogFormProfile("hardware");
    expect(catalog.suggestedCategories).toContain("Ciment");
    expect(catalog.suggestedCategories).toContain("Visserie");
    expect(catalog.units).toContain("TONNE");
    expect(catalog.units).toContain("METER");
    expect(catalog.showPackaging).toBe(false);
    expect(shouldShowCatalogCategory("Boissons", catalog)).toBe(false);
    expect(shouldShowCatalogCategory("Ciment", catalog)).toBe(true);
  });
});
