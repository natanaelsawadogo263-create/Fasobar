import { describe, expect, it } from "vitest";

import {
  computeStockStatus,
  canManageDepartmentStock,
  resolveStockPermissions,
  formatQuantity,
} from "@/lib/stock/constants";
import {
  stockEntrySchema,
  stockFiltersSchema,
  stockLossSchema,
  stockAdjustmentSchema,
  createSupplierSchema,
  createStockItemSchema,
  updateSupplierSchema,
} from "@/lib/stock/schemas";

describe("stock schemas", () => {
  it("valide une entrée de stock", () => {
    const result = stockEntrySchema.safeParse({
      stockItemId: "00000000-0000-4000-8000-000000000001",
      movementType: "PURCHASE",
      purchasedQuantity: 2,
      conversionFactor: 24,
      unitCost: 500,
      supplierId: "",
      reference: "FA-001",
    });

    expect(result.success).toBe(true);
  });

  it("arrondit un coût unitaire décimal issu d'un prix de paquet", () => {
    const result = stockEntrySchema.safeParse({
      stockItemId: "00000000-0000-4000-8000-000000000001",
      movementType: "PURCHASE",
      purchasedQuantity: 2,
      conversionFactor: 24,
      unitCost: 10000 / 24,
      supplierId: "00000000-0000-4000-8000-000000000099",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unitCost).toBe(417);
    }
  });

  it("refuse une quantité négative pour une perte", () => {
    const result = stockLossSchema.safeParse({
      stockItemId: "00000000-0000-4000-8000-000000000001",
      movementType: "LOSS",
      quantity: -1,
      reason: "Casse",
    });

    expect(result.success).toBe(false);
  });

  it("exige une confirmation pour une correction", () => {
    const result = stockAdjustmentSchema.safeParse({
      stockItemId: "00000000-0000-4000-8000-000000000001",
      newQuantity: 10,
      reason: "Écart inventaire",
      confirmed: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmed).toBe(false);
    }
  });

  it("parse les filtres stock", () => {
    const result = stockFiltersSchema.safeParse({
      tab: "alerts",
      search: "flag",
      categoryId: "",
      status: "low",
    });

    expect(result.success).toBe(true);
  });

  it("valide un article de stock complet", () => {
    const result = createStockItemSchema.safeParse({
      name: "Bière Brakina",
      departmentCode: "BAR",
      productId: "",
      unit: "BOTTLE",
      initialQuantity: 120,
      minimumQuantity: 20,
      active: true,
      confirmDuplicateProductLink: false,
    });

    expect(result.success).toBe(true);
  });

  it("valide une mise à jour fournisseur", () => {
    const result = updateSupplierSchema.safeParse({
      supplierId: "00000000-0000-4000-8000-000000000099",
      name: "Grossiste Central",
      phone: "+226 70 00 00 00",
      departmentCode: "BAR",
      active: true,
    });

    expect(result.success).toBe(true);
  });

  it("valide un fournisseur", () => {
    const result = createSupplierSchema.safeParse({
      name: "Société ABC",
      phone: "+226 70 00 00 00",
      departmentCode: "KITCHEN",
      active: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.departmentCode).toBe("KITCHEN");
    }
  });
});

describe("stock helpers", () => {
  it("calcule le statut OK", () => {
    expect(computeStockStatus(10, 5, true)).toBe("ok");
  });

  it("calcule le statut stock faible", () => {
    expect(computeStockStatus(3, 5, true)).toBe("low");
  });

  it("calcule le statut rupture", () => {
    expect(computeStockStatus(0, 5, true)).toBe("out");
  });

  it("autorise le BAR_MANAGER sur le département bar", () => {
    expect(canManageDepartmentStock("MEMBER", "BAR_MANAGER", "BAR")).toBe(true);
    expect(canManageDepartmentStock("MEMBER", "BAR_MANAGER", "KITCHEN")).toBe(false);
  });

  it("résout les permissions stock", () => {
    const permissions = resolveStockPermissions("OWNER", "MEMBER");
    expect(permissions.canManageStock).toBe(true);
    expect(permissions.canReadStock).toBe(true);
  });

  it("formate une quantité avec unité", () => {
    expect(formatQuantity(12, "BOTTLE")).toContain("12");
  });
});
