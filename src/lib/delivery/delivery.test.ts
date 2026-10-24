import { describe, expect, it } from "vitest";

import { getInvitableSpacesForActivity } from "@/lib/activity/profile";
import {
  canOperateCashRegister,
  inviteSpaceToRole,
  resolveHomePathForRoles,
  resolveUserSpace,
  roleToSpaceLabel,
} from "@/lib/auth/roles";
import {
  courierHistoryStart,
  deliveryOrderStage,
  parseCourierHistoryPeriod,
} from "@/lib/delivery/constants";
import {
  cashDeliveryOrderSchema,
  createDeliveryOrderSchema,
  toRpcItems,
} from "@/lib/delivery/schemas";
import { getNavigationForSpace, isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { createEmployeeAccountSchema } from "@/lib/users/schemas";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000010";

describe("rôle Livreur (e-commerce)", () => {
  it("DELIVERY_AGENT arrive dans l'espace livreur, jamais admin", () => {
    expect(resolveUserSpace("DELIVERY_AGENT", "DELIVERY_AGENT")).toBe("delivery");
    expect(resolveHomePathForRoles("DELIVERY_AGENT", "DELIVERY_AGENT", "ecommerce")).toBe(
      "/application/livreur",
    );
    expect(roleToSpaceLabel("DELIVERY_AGENT")).toBe("Livreur");
    expect(canOperateCashRegister("DELIVERY_AGENT", "DELIVERY_AGENT", "ecommerce")).toBe(false);
  });

  it("le formulaire employé accepte l'espace livreur", () => {
    expect(inviteSpaceToRole("delivery")).toBe("DELIVERY_AGENT");
    const parsed = createEmployeeAccountSchema.safeParse({
      fullName: "Issa Ouédraogo",
      loginIdentifier: "issa.livreur",
      space: "delivery",
      establishmentId: "00000000-0000-4000-8000-000000000001",
    });
    expect(parsed.success).toBe(true);
  });

  it("l'espace Livreur n'est proposé qu'aux établissements e-commerce", () => {
    const ecommerce = getInvitableSpacesForActivity("ecommerce", "BOTH").map((s) => s.id);
    expect(ecommerce).toContain("delivery");

    for (const activity of ["restaurant", "supermarket", "hardware", "gas_station", "other"]) {
      const ids = getInvitableSpacesForActivity(activity, "BOTH").map((s) => s.id);
      expect(ids).not.toContain("delivery");
    }
  });
});

describe("accès aux pages livraisons", () => {
  it("le livreur ne voit que son espace", () => {
    expect(isPathAllowedForSpace("/application/livreur", "delivery", "BOTH", "ecommerce")).toBe(true);
    expect(isPathAllowedForSpace("/application/livreurs", "delivery", "BOTH", "ecommerce")).toBe(false);
    expect(isPathAllowedForSpace("/application/livraisons", "delivery", "BOTH", "ecommerce")).toBe(false);
    expect(isPathAllowedForSpace("/application/stock", "delivery", "BOTH", "ecommerce")).toBe(false);
    expect(isPathAllowedForSpace("/application/caisse", "delivery", "BOTH", "ecommerce")).toBe(false);
    expect(isPathAllowedForSpace("/application/utilisateurs", "delivery", "BOTH", "ecommerce")).toBe(false);
    expect(
      getNavigationForSpace("delivery", "BOTH", "ecommerce").every((i) =>
        i.href.startsWith("/application/livreur"),
      ),
    ).toBe(true);
  });

  it("la caissière e-commerce gère les livraisons, pas les livreurs", () => {
    expect(
      isPathAllowedForSpace("/application/livraisons", "cashier_kitchen", "BOTH", "ecommerce"),
    ).toBe(true);
    expect(
      isPathAllowedForSpace("/application/livreurs", "cashier_kitchen", "BOTH", "ecommerce"),
    ).toBe(false);
    expect(
      getNavigationForSpace("cashier_kitchen", "BOTH", "ecommerce").map((i) => i.href),
    ).toContain("/application/livraisons");
  });

  it("l'admin e-commerce a Livraisons et Livreurs dans son menu", () => {
    const hrefs = getNavigationForSpace("admin", "BOTH", "ecommerce").map((i) => i.href);
    expect(hrefs).toContain("/application/livraisons");
    expect(hrefs).toContain("/application/livreurs");
    expect(isPathAllowedForSpace("/application/livreurs/abc", "admin", "BOTH", "ecommerce")).toBe(true);
  });

  it("les autres types d'établissement n'ont ni menu ni accès livraisons", () => {
    for (const activity of ["restaurant", "supermarket", "hardware", "gas_station", "other"]) {
      for (const space of ["admin", "cashier_kitchen", "bar_manager"] as const) {
        const hrefs = getNavigationForSpace(space, "BOTH", activity).map((i) => i.href);
        expect(hrefs).not.toContain("/application/livraisons");
        expect(hrefs).not.toContain("/application/livreurs");
        expect(isPathAllowedForSpace("/application/livraisons", space, "BOTH", activity)).toBe(false);
        expect(isPathAllowedForSpace("/application/livreurs", space, "BOTH", activity)).toBe(false);
        expect(isPathAllowedForSpace("/application/livreur", space, "BOTH", activity)).toBe(false);
      }
    }
  });
});

describe("formulaire de commande", () => {
  it("refuse une commande vide ou une quantité nulle", () => {
    expect(createDeliveryOrderSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      createDeliveryOrderSchema.safeParse({ items: [{ productId: PRODUCT_ID, quantity: 0 }] })
        .success,
    ).toBe(false);
  });

  it("accepte une commande sans infos client et prépare le format SQL", () => {
    const parsed = createDeliveryOrderSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      customerName: "  ",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.customerName).toBeUndefined();
    expect(toRpcItems(parsed.data.items)).toEqual([{ product_id: PRODUCT_ID, quantity: 2 }]);
  });
});

describe("historique des livraisons du livreur", () => {
  it("période inconnue ou absente → 7 jours par défaut", () => {
    expect(parseCourierHistoryPeriod(undefined)).toBe("7j");
    expect(parseCourierHistoryPeriod("n'importe quoi")).toBe("7j");
    expect(parseCourierHistoryPeriod("30j")).toBe("30j");
  });

  it("le début de période inclut aujourd'hui, à minuit", () => {
    const now = new Date(2026, 9, 25, 15, 30);
    expect(courierHistoryStart("aujourdhui", now)).toEqual(new Date(2026, 9, 25, 0, 0, 0, 0));
    expect(courierHistoryStart("7j", now)).toEqual(new Date(2026, 9, 19, 0, 0, 0, 0));
    expect(courierHistoryStart("30j", now)).toEqual(new Date(2026, 8, 26, 0, 0, 0, 0));
  });
});

describe("menu de l'espace livreur", () => {
  it("propose les 4 pages du livreur, toutes autorisées", () => {
    const hrefs = getNavigationForSpace("delivery", "BOTH", "ecommerce").map((item) => item.href);
    expect(hrefs).toEqual([
      "/application/livreur",
      "/application/livreur/en-cours",
      "/application/livreur/historique",
      "/application/livreur/stock",
    ]);
    for (const href of hrefs) {
      expect(isPathAllowedForSpace(href, "delivery", "BOTH", "ecommerce")).toBe(true);
    }
  });
});

describe("encaissement des livraisons par la caisse", () => {
  const ORDER_ID = "00000000-0000-4000-8000-000000000020";

  it("une livraison livrée reste « à encaisser » tant que la caisse ne l'a pas encaissée", () => {
    expect(deliveryOrderStage({ status: "DELIVERED", cashedAt: null })).toBe("TO_CASH");
    expect(deliveryOrderStage({ status: "DELIVERED", cashedAt: "2026-10-25T10:00:00Z" })).toBe("CASHED");
    expect(deliveryOrderStage({ status: "ACCEPTED", cashedAt: null })).toBe("ACCEPTED");
  });

  it("valide le mode de paiement ; le montant reçu ne compte qu'en espèces", () => {
    const cash = cashDeliveryOrderSchema.parse({ orderId: ORDER_ID, method: "CASH", amountReceived: 10000 });
    expect(cash.amountReceived).toBe(10000);

    const momo = cashDeliveryOrderSchema.parse({
      orderId: ORDER_ID,
      method: "ORANGE_MONEY",
      amountReceived: 10000,
      transactionReference: " CI123 ",
    });
    expect(momo.amountReceived).toBeUndefined();
    expect(momo.transactionReference).toBe("CI123");

    expect(cashDeliveryOrderSchema.safeParse({ orderId: ORDER_ID, method: "BITCOIN" }).success).toBe(false);
    expect(cashDeliveryOrderSchema.safeParse({ orderId: "x", method: "CASH" }).success).toBe(false);
  });
});
