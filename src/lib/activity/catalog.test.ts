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

  it("organise la téléphonie comme une boutique high-tech, pas une quincaillerie", () => {
    const catalog = getCatalogFormProfile("phones");
    expect(catalog.kind).toBe("retail");
    expect(catalog.defaultUnit).toBe("PIECE");
    expect(catalog.units).toEqual(["PIECE", "PACK"]);
    expect(catalog.units).not.toContain("TONNE");
    expect(catalog.units).not.toContain("METER");
    expect(catalog.suggestedCategories).toContain("Téléphones");
    expect(catalog.suggestedCategories).toContain("Ordinateurs");
    expect(catalog.suggestedCategories).toContain("Accessoires");
    expect(catalog.suggestedCategories).not.toContain("Ciment");
    expect(catalog.suggestedCategories).not.toContain("Visserie");
    expect(shouldShowCatalogCategory("Téléphones", catalog)).toBe(true);
    expect(shouldShowCatalogCategory("Ordinateurs", catalog)).toBe(true);
    expect(shouldShowCatalogCategory("Ciment", catalog)).toBe(false);
    expect(shouldShowCatalogCategory("Visserie", catalog)).toBe(false);
    expect(shouldShowCatalogCategory("Boissons", catalog)).toBe(false);
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

  it("prépare le catalogue matériaux comme un dépôt", () => {
    const catalog = getCatalogFormProfile("construction");
    expect(catalog.units).toContain("TONNE");
    expect(catalog.suggestedCategories).toContain("Toiture");
  });
});
