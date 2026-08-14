import { describe, expect, it } from "vitest";

import { isHardwareActivity } from "@/lib/hardware/activity";
import { HARDWARE_CREDIT_LIMIT_XOF } from "@/lib/hardware/constants";
import { hardwarePermissions } from "@/lib/hardware/permissions";
import {
  applyQuantityDiscount,
  canGrantCustomerCredit,
  cashCloseVariance,
  remainingCustomerCredit,
  resolveSaleUnitPrice,
} from "@/lib/hardware/pricing";
import { canFulfillSale, toBaseStockQuantity } from "@/lib/hardware/units";

describe("activité quincaillerie", () => {
  it("ne s’active que pour hardware", () => {
    expect(isHardwareActivity("hardware")).toBe(true);
    expect(isHardwareActivity("pharmacy")).toBe(false);
    expect(isHardwareActivity("restaurant")).toBe(false);
  });
});

describe("permissions quincaillerie", () => {
  it("laisse l’admin vendre et gérer le catalogue", () => {
    const perms = hardwarePermissions({
      activityCode: "hardware",
      userSpace: "admin",
      organizationRole: "OWNER",
      establishmentRole: "OWNER",
    });
    expect(perms.canSell).toBe(true);
    expect(perms.canCreateCustomer).toBe(true);
    expect(perms.canCreateExpense).toBe(true);
    expect(perms.canManageUsers).toBe(true);
  });

  it("restreint le caisse-vendeur", () => {
    const perms = hardwarePermissions({
      activityCode: "hardware",
      userSpace: "cashier_kitchen",
      organizationRole: "CASHIER_KITCHEN",
      establishmentRole: "CASHIER_KITCHEN",
    });
    expect(perms.canSell).toBe(true);
    expect(perms.canCreateCustomer).toBe(false);
    expect(perms.canEditPrice).toBe(false);
    expect(perms.canManageStock).toBe(false);
    expect(perms.canCreateExpense).toBe(false);
    expect(perms.canManageUsers).toBe(false);
  });

  it("autorise le responsable stock sans vente", () => {
    const perms = hardwarePermissions({
      activityCode: "hardware",
      userSpace: "bar_manager",
      organizationRole: "BAR_MANAGER",
      establishmentRole: "BAR_MANAGER",
    });
    expect(perms.canSell).toBe(false);
    expect(perms.canManageCatalog).toBe(true);
    expect(perms.canManageStock).toBe(true);
    expect(perms.canCreateExpense).toBe(true);
    expect(perms.canGrantCredit).toBe(false);
  });
});

describe("prix, remises, crédit, conversions", () => {
  it("applique le prix gros s’il existe", () => {
    expect(
      resolveSaleUnitPrice({
        saleMode: "WHOLESALE",
        retailPrice: 5000,
        wholesalePrice: 4200,
      }),
    ).toBe(4200);
    expect(
      resolveSaleUnitPrice({
        saleMode: "WHOLESALE",
        retailPrice: 5000,
        wholesalePrice: null,
      }),
    ).toBe(5000);
  });

  it("applique la remise quantité configurée seulement", () => {
    expect(
      applyQuantityDiscount({
        unitPrice: 10000,
        quantity: 50,
        minQuantity: 50,
        percent: 3,
      }),
    ).toEqual({ unitPrice: 9700, discountPercent: 3 });
    expect(
      applyQuantityDiscount({
        unitPrice: 10000,
        quantity: 10,
        minQuantity: 50,
        percent: 3,
      }).discountPercent,
    ).toBe(0);
  });

  it("plafonne le crédit client à 300 000 F", () => {
    expect(remainingCustomerCredit(250_000)).toBe(50_000);
    expect(
      canGrantCustomerCredit({
        currentDebtXof: 250_000,
        additionalCreditXof: 50_000,
      }),
    ).toBe(true);
    expect(
      canGrantCustomerCredit({
        currentDebtXof: 250_000,
        additionalCreditXof: 50_001,
      }),
    ).toBe(false);
    expect(HARDWARE_CREDIT_LIMIT_XOF).toBe(300_000);
  });

  it("convertit les conditionnements vers l’unité de base", () => {
    expect(toBaseStockQuantity(5, 20)).toBe(100);
    expect(canFulfillSale(100, 20)).toBe(true);
    expect(canFulfillSale(10, 20)).toBe(false);
  });

  it("calcule l’écart de caisse après déclaration", () => {
    expect(cashCloseVariance(100_000, 100_000)).toEqual({
      variance: 0,
      status: "balanced",
    });
    expect(cashCloseVariance(102_000, 100_000).status).toBe("surplus");
    expect(cashCloseVariance(98_000, 100_000).status).toBe("shortage");
  });
});
