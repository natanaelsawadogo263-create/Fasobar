import { describe, expect, it } from "vitest";

import {
  createProductSchema,
  productFiltersSchema,
  updateProductPriceSchema,
  updateProductSchema,
} from "@/lib/products/schemas";
import { formatPriceXof, inferFractionableFromUnit, MANAGEMENT_ROLES } from "@/lib/products/constants";

describe("product schemas", () => {
  it("valide un produit complet", () => {
    const result = createProductSchema.safeParse({
      name: "Flag 65cl",
      departmentCode: "BAR",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 1000,
      unit: "BOTTLE",
      minimumStock: 5,
      description: "Bière locale",
      active: true,
      packagingUnit: "CASE",
      unitsPerPack: 12,
    });

    expect(result.success).toBe(true);
  });

  it("accepte un article commerce sans casier", () => {
    const result = createProductSchema.safeParse({
      name: "Paracétamol 500 mg",
      departmentCode: "BAR",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 500,
      unit: "PIECE",
      minimumStock: 10,
      active: true,
      catalogKind: "retail",
    });

    expect(result.success).toBe(true);
  });

  it("accepte un produit supermarché vendu à l’unité et acheté en lot", () => {
    const result = createProductSchema.safeParse({
      name: "Huile 5 L",
      departmentCode: "BAR",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 4500,
      unit: "JERRYCAN",
      minimumStock: 5,
      active: true,
      catalogKind: "retail",
      packagingUnit: "CARTON",
      unitsPerPack: 5,
      lotSellingPrice: 20000,
    });

    expect(result.success).toBe(true);
  });

  it("accepte un pack de sachets d’eau", () => {
    const result = createProductSchema.safeParse({
      name: "Eau sachet",
      departmentCode: "BAR",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 25,
      unit: "SACHET",
      minimumStock: 40,
      active: true,
      catalogKind: "retail",
      packagingUnit: "PACK",
      unitsPerPack: 20,
      lotSellingPrice: 400,
    });

    expect(result.success).toBe(true);
  });

  it("refuse un lot supermarché sans prix de vente du lot", () => {
    const result = createProductSchema.safeParse({
      name: "Huile 5 L",
      departmentCode: "BAR",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 4500,
      unit: "JERRYCAN",
      minimumStock: 5,
      active: true,
      catalogKind: "retail",
      packagingUnit: "CARTON",
      unitsPerPack: 5,
    });

    expect(result.success).toBe(false);
  });

  it("accepte une nouvelle catégorie commerce", () => {
    const result = createProductSchema.safeParse({
      name: "T-shirt col rond",
      departmentCode: "BAR",
      categoryId: "",
      newCategoryName: "Homme",
      sellingPrice: 3500,
      unit: "PIECE",
      minimumStock: 0,
      active: true,
      catalogKind: "retail",
    });

    expect(result.success).toBe(true);
  });

  // Régression : modifier un produit tout en créant sa propre catégorie
  // échouait toujours ("Catégorie invalide.") — updateProductSchema exigeait
  // un UUID strict et ignorait newCategoryName, contrairement à createProductSchema.
  it("accepte une nouvelle catégorie lors d'une modification", () => {
    const result = updateProductSchema.safeParse({
      productId: "00000000-0000-4000-8000-000000000009",
      name: "T-shirt col rond",
      departmentCode: "BAR",
      categoryId: "",
      newCategoryName: "Homme",
      sellingPrice: 3500,
      unit: "PIECE",
      minimumStock: 0,
      active: true,
    });

    expect(result.success).toBe(true);
  });

  it("refuse une modification sans catégorie ni nouvelle catégorie", () => {
    const result = updateProductSchema.safeParse({
      productId: "00000000-0000-4000-8000-000000000009",
      name: "T-shirt col rond",
      departmentCode: "BAR",
      categoryId: "",
      sellingPrice: 3500,
      unit: "PIECE",
      minimumStock: 0,
      active: true,
    });

    expect(result.success).toBe(false);
  });

  it("refuse une boisson sans conditionnement", () => {
    const result = createProductSchema.safeParse({
      name: "Brakina",
      departmentCode: "BAR",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 800,
      unit: "BOTTLE",
      minimumStock: 0,
      active: true,
    });

    expect(result.success).toBe(false);
  });

  it("accepte une nourriture sans conditionnement", () => {
    const result = createProductSchema.safeParse({
      name: "Poulet braisé",
      departmentCode: "KITCHEN",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 2500,
      unit: "PORTION",
      minimumStock: 0,
      active: true,
    });

    expect(result.success).toBe(true);
  });

  it("refuse un prix négatif", () => {
    const result = createProductSchema.safeParse({
      name: "Poulet braisé",
      departmentCode: "KITCHEN",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: -100,
      unit: "PORTION",
      minimumStock: 0,
      active: true,
    });

    expect(result.success).toBe(false);
  });

  it("accepte un stock actuel à la création", () => {
    const result = createProductSchema.safeParse({
      name: "Huile 5 L",
      departmentCode: "BAR",
      categoryId: "00000000-0000-4000-8000-000000000001",
      sellingPrice: 4500,
      unit: "JERRYCAN",
      minimumStock: 2,
      initialStock: 15,
      active: true,
      catalogKind: "retail",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initialStock).toBe(15);
    }
  });

  it("valide une mise à jour de prix", () => {
    const result = updateProductPriceSchema.safeParse({
      productId: "00000000-0000-4000-8000-000000000099",
      sellingPrice: 2500,
    });

    expect(result.success).toBe(true);
  });

  it("parse les filtres produits", () => {
    const result = productFiltersSchema.safeParse({
      tab: "bar",
      search: "flag",
      categoryId: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tab).toBe("bar");
    }
  });
});

describe("product helpers", () => {
  it("formate un prix XOF", () => {
    expect(formatPriceXof(1500)).toContain("1");
    expect(formatPriceXof(1500)).toContain("F");
  });

  it("identifie les rôles de gestion", () => {
    expect(MANAGEMENT_ROLES.has("OWNER")).toBe(true);
    expect(MANAGEMENT_ROLES.has("CASHIER")).toBe(false);
  });

  it("active la vente fractionnée pour kg et litre", () => {
    expect(inferFractionableFromUnit("KG")).toBe(true);
    expect(inferFractionableFromUnit("LITER")).toBe(true);
    expect(inferFractionableFromUnit("PIECE")).toBe(false);
  });
});
