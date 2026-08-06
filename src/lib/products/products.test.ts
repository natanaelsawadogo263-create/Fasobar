import { describe, expect, it } from "vitest";

import {
  createProductSchema,
  productFiltersSchema,
  updateProductPriceSchema,
} from "@/lib/products/schemas";
import { formatPriceXof, MANAGEMENT_ROLES } from "@/lib/products/constants";

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
});
