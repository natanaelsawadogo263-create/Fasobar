import { describe, expect, it } from "vitest";

import { resolveOrderPermissions, formatOrderNumber } from "@/lib/orders/constants";
import {
  cancelOrderSchema,
  cartItemSchema,
  createOrderSchema,
  saveOrderSchema,
} from "@/lib/orders/schemas";

describe("order schemas", () => {
  it("valide une création de commande", () => {
    const result = createOrderSchema.safeParse({
      tableReference: "T12",
      orderType: "ON_SITE",
    });

    expect(result.success).toBe(true);
  });

  it("valide un article de panier", () => {
    const result = cartItemSchema.safeParse({
      productId: "00000000-0000-4000-8000-000000000001",
      quantity: 2,
    });

    expect(result.success).toBe(true);
  });

  it("refuse une commande sans article pour enregistrement", () => {
    const result = saveOrderSchema.safeParse({
      orderId: "00000000-0000-4000-8000-000000000099",
      orderType: "ON_SITE",
      targetStatus: "OPEN",
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it("exige une confirmation pour annuler", () => {
    const result = cancelOrderSchema.safeParse({
      orderId: "00000000-0000-4000-8000-000000000099",
      reason: "Client parti",
      confirmed: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmed).toBe(false);
    }
  });
});

describe("order helpers", () => {
  it("autorise la caissière à gérer les commandes", () => {
    const permissions = resolveOrderPermissions("MEMBER", "CASHIER");
    expect(permissions.canManageOrders).toBe(true);
    expect(permissions.canReadOrders).toBe(true);
  });

  it("formate un numéro de commande", () => {
    expect(formatOrderNumber(12)).toBe("#0012");
  });
});
