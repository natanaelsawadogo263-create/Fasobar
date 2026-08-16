import { describe, expect, it } from "vitest";

import {
  canOperateCashRegister,
  inviteSpaceToRole,
  membershipRoleIsCashierKitchen,
  resolveHomePathForRoles,
  resolveUserSpace,
  roleToSpaceLabel,
} from "@/lib/auth/roles";
import { isPathAllowedForSpace, getNavigationForSpace } from "@/lib/navigation/space-navigation";
import { createEmployeeAccountSchema } from "@/lib/users/schemas";

describe("trois espaces utilisateurs", () => {
  it("1-4. OWNER et ADMIN arrivent sur le tableau de bord admin", () => {
    expect(resolveUserSpace("OWNER", "OWNER")).toBe("admin");
    expect(resolveUserSpace("ADMIN", "ADMIN")).toBe("admin");
    expect(resolveHomePathForRoles("OWNER", "OWNER")).toBe("/application/tableau-de-bord");
    expect(resolveHomePathForRoles("ADMIN", "ADMIN")).toBe("/application/tableau-de-bord");
  });

  it("5-6. CASHIER_KITCHEN et legacy CASHIER/KITCHEN_MANAGER vont à la caisse", () => {
    expect(resolveUserSpace("CASHIER_KITCHEN", "CASHIER_KITCHEN")).toBe("cashier_kitchen");
    expect(resolveUserSpace("CASHIER", "CASHIER")).toBe("cashier_kitchen");
    expect(resolveUserSpace("KITCHEN_MANAGER", "KITCHEN_MANAGER")).toBe("cashier_kitchen");
    expect(resolveHomePathForRoles("CASHIER", "CASHIER")).toBe("/application/caisse");
    expect(resolveHomePathForRoles("KITCHEN_MANAGER", "KITCHEN_MANAGER")).toBe("/application/caisse");
    expect(canOperateCashRegister("CASHIER_KITCHEN", "CASHIER_KITCHEN")).toBe(true);
    expect(canOperateCashRegister("OWNER", "OWNER")).toBe(false);
    expect(canOperateCashRegister("ADMIN", "ADMIN")).toBe(false);
    expect(canOperateCashRegister("MANAGER", "MANAGER")).toBe(false);
  });

  it("7. BAR_MANAGER va vers l'espace Bar", () => {
    expect(resolveUserSpace("BAR_MANAGER", "BAR_MANAGER")).toBe("bar_manager");
    expect(resolveHomePathForRoles("BAR_MANAGER", "BAR_MANAGER")).toBe("/application/bar");
  });

  it("8-9. formulaire d'invitation n'accepte que les trois espaces", () => {
    expect(inviteSpaceToRole("admin")).toBe("ADMIN");
    expect(inviteSpaceToRole("cashier_kitchen")).toBe("CASHIER_KITCHEN");
    expect(inviteSpaceToRole("bar_manager")).toBe("BAR_MANAGER");
  });

  it("10. email invalide refusé", () => {
    const result = createEmployeeAccountSchema.safeParse({
      fullName: "Marie Konaté",
      email: "pas-un-email",
      space: "cashier_kitchen",
      establishmentId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result.success).toBe(false);
  });

  it("11. formulaire valide pour compte Caisse–Cuisine", () => {
    const result = createEmployeeAccountSchema.safeParse({
      fullName: "Marie Konaté",
      loginIdentifier: "marie.konate",
      space: "cashier_kitchen",
      establishmentId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result.success).toBe(true);
  });

  it("12. formulaire valide pour compte Responsable Bar", () => {
    const result = createEmployeeAccountSchema.safeParse({
      fullName: "Moussa Traoré",
      loginIdentifier: "moussa.traore",
      space: "bar_manager",
      establishmentId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result.success).toBe(true);
  });
});

describe("protections de routes par espace", () => {
  it("13. Caisse–Cuisine ne peut pas ouvrir utilisateurs", () => {
    expect(isPathAllowedForSpace("/application/utilisateurs", "cashier_kitchen")).toBe(false);
  });

  it("14. Responsable Bar ne peut pas ouvrir encaissement", () => {
    expect(isPathAllowedForSpace("/application/encaissement/abc", "bar_manager")).toBe(false);
  });

  it("15. Responsable Bar ne peut pas voir stock Cuisine", () => {
    expect(isPathAllowedForSpace("/application/stock/cuisine", "bar_manager")).toBe(false);
  });

  it("16. Caisse–Cuisine ne peut pas gérer stock Bar", () => {
    expect(isPathAllowedForSpace("/application/stock/boissons", "cashier_kitchen")).toBe(false);
  });

  it("17. Admin accède à l'admin, sans opérations de caisse", () => {
    expect(isPathAllowedForSpace("/application/utilisateurs", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/stock/boissons", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/depenses", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/commandes", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/commandes/order-1", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/caisses", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/ventes", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/rapports", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/parametres", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/recus/abc", "admin")).toBe(true);
    expect(isPathAllowedForSpace("/application/caisse", "admin")).toBe(false);
    expect(isPathAllowedForSpace("/application/caisse/session", "admin")).toBe(false);
    expect(isPathAllowedForSpace("/application/encaissement/x", "admin")).toBe(false);
    expect(isPathAllowedForSpace("/application/commandes-ouvertes", "admin")).toBe(false);
    expect(isPathAllowedForSpace("/application/cuisine", "admin")).toBe(false);
  });

  it("18. Caisse–Cuisine accède aux routes opérationnelles", () => {
    expect(isPathAllowedForSpace("/application/caisse", "cashier_kitchen")).toBe(true);
    expect(isPathAllowedForSpace("/application/commandes-ouvertes", "cashier_kitchen")).toBe(true);
    expect(isPathAllowedForSpace("/application/commandes/order-1", "cashier_kitchen")).toBe(true);
    expect(isPathAllowedForSpace("/application/commandes", "cashier_kitchen")).toBe(false);
    expect(isPathAllowedForSpace("/application/caisses", "cashier_kitchen")).toBe(false);
    expect(isPathAllowedForSpace("/application/depenses", "cashier_kitchen")).toBe(true);
    expect(isPathAllowedForSpace("/application/approvisionnements", "cashier_kitchen")).toBe(true);
    expect(isPathAllowedForSpace("/application/cuisine", "cashier_kitchen")).toBe(true);
    expect(isPathAllowedForSpace("/application/encaissement/order-1", "cashier_kitchen")).toBe(true);
  });

  it("19. Responsable Bar accède aux routes Bar autorisées", () => {
    expect(isPathAllowedForSpace("/application/bar", "bar_manager")).toBe(true);
    expect(isPathAllowedForSpace("/application/bar/commandes", "bar_manager")).toBe(true);
    expect(isPathAllowedForSpace("/application/bar/stock", "bar_manager")).toBe(true);
    expect(isPathAllowedForSpace("/application/bar/approvisionnements", "bar_manager")).toBe(true);
    expect(isPathAllowedForSpace("/application/bar/operations", "bar_manager")).toBe(false);
    expect(isPathAllowedForSpace("/application/bar/historique", "bar_manager")).toBe(true);
    expect(isPathAllowedForSpace("/application/bar/session", "bar_manager")).toBe(true);
    expect(isPathAllowedForSpace("/application/depenses", "bar_manager")).toBe(true);
    expect(isPathAllowedForSpace("/application/approvisionnements", "bar_manager")).toBe(false);
    expect(isPathAllowedForSpace("/application/produits", "bar_manager")).toBe(false);
    expect(isPathAllowedForSpace("/application/stock/boissons", "bar_manager")).toBe(false);
  });
});

describe("compatibilité anciens rôles", () => {
  it("25. CASHIER et KITCHEN_MANAGER restent compatibles", () => {
    expect(membershipRoleIsCashierKitchen("CASHIER")).toBe(true);
    expect(membershipRoleIsCashierKitchen("KITCHEN_MANAGER")).toBe(true);
    expect(membershipRoleIsCashierKitchen("CASHIER_KITCHEN")).toBe(true);
    expect(roleToSpaceLabel("CASHIER")).toBe("Cuisine");
    expect(roleToSpaceLabel("KITCHEN_MANAGER")).toBe("Cuisine");
  });
});

describe("profil d’exploitation", () => {
  it("masque Sessions Bar si nourriture uniquement", () => {
    const items = getNavigationForSpace("admin", "KITCHEN");
    expect(items.some((item) => item.href === "/application/sessions-bar")).toBe(false);
    expect(items.some((item) => item.href === "/application/parametres")).toBe(true);
  });

  it("masque Cuisine si boissons uniquement", () => {
    const items = getNavigationForSpace("cashier_kitchen", "BAR");
    expect(items.some((item) => item.href === "/application/cuisine")).toBe(false);
    expect(items.some((item) => item.href === "/application/caisse")).toBe(true);
  });

  it("refuse les chemins hors périmètre pour l’admin", () => {
    expect(
      isPathAllowedForSpace("/application/sessions-bar", "admin", "KITCHEN"),
    ).toBe(false);
    expect(
      isPathAllowedForSpace("/application/stock/cuisine", "admin", "BAR"),
    ).toBe(false);
    expect(
      isPathAllowedForSpace("/application/stock/boissons", "admin", "BAR"),
    ).toBe(true);
  });

  it("adapte la navigation commerce : pas de cuisine, sessions bar ni Tickets", () => {
    const items = getNavigationForSpace("admin", "BAR", "pharmacy");
    expect(items.some((item) => item.href === "/application/sessions-bar")).toBe(false);
    expect(items.some((item) => item.href === "/application/cuisine")).toBe(false);
    expect(items.some((item) => item.href === "/application/commandes")).toBe(false);
    expect(items.find((item) => item.href === "/application/produits")?.label).toBe(
      "Produits",
    );
    expect(items.some((item) => item.href === "/application/ventes")).toBe(true);
    expect(
      isPathAllowedForSpace("/application/commandes", "admin", "BAR", "pharmacy"),
    ).toBe(false);
    expect(
      isPathAllowedForSpace("/application/commandes/order-1", "admin", "BAR", "pharmacy"),
    ).toBe(true);
  });

  it("limite le caissier commerce à la vente", () => {
    const items = getNavigationForSpace("cashier_kitchen", "BAR", "pharmacy");
    expect(items.map((item) => item.href)).toEqual([
      "/application/caisse",
      "/application/commandes-ouvertes",
      "/application/caisse/session",
    ]);
    expect(items.some((item) => item.href === "/application/stock")).toBe(false);
    expect(items.some((item) => item.href === "/application/cuisine")).toBe(false);
    expect(
      isPathAllowedForSpace(
        "/application/stock",
        "cashier_kitchen",
        "BAR",
        "pharmacy",
      ),
    ).toBe(false);
    expect(
      isPathAllowedForSpace("/application/cuisine", "cashier_kitchen", "BAR", "pharmacy"),
    ).toBe(false);
    expect(
      isPathAllowedForSpace("/application/bar", "admin", "BAR", "pharmacy"),
    ).toBe(false);
    expect(canOperateCashRegister("OWNER", "OWNER", "pharmacy")).toBe(true);
    expect(resolveHomePathForRoles("BAR_MANAGER", "BAR_MANAGER", "pharmacy")).toBe(
      "/application/stock",
    );
  });

  it("organise la quincaillerie : vente admin, caisse restreinte, responsable stock", () => {
    const adminNav = getNavigationForSpace("admin", "BOTH", "hardware");
    expect(adminNav.some((item) => item.href === "/application/caisse")).toBe(false);
    expect(adminNav.some((item) => item.label === "Accueil")).toBe(true);

    const cashierNav = getNavigationForSpace("cashier_kitchen", "BOTH", "hardware");
    expect(cashierNav.map((item) => item.href)).toEqual([
      "/application/caisse",
      "/application/commandes-ouvertes",
      "/application/caisse/session",
    ]);
    expect(
      isPathAllowedForSpace("/application/depenses", "cashier_kitchen", "BOTH", "hardware"),
    ).toBe(false);
    expect(
      isPathAllowedForSpace("/application/caisse", "admin", "BOTH", "hardware"),
    ).toBe(true);

    const stockNav = getNavigationForSpace("bar_manager", "BOTH", "hardware");
    expect(stockNav[0]?.label).toBe("Accueil");
    expect(stockNav.map((item) => item.href)).toEqual([
      "/application/stock",
      "/application/produits",
      "/application/approvisionnements",
      "/application/depenses",
    ]);
    expect(
      isPathAllowedForSpace("/application/caisse", "bar_manager", "BOTH", "hardware"),
    ).toBe(false);
    expect(
      isPathAllowedForSpace("/application/produits", "bar_manager", "BOTH", "hardware"),
    ).toBe(true);
    expect(
      isPathAllowedForSpace("/application/depenses", "bar_manager", "BOTH", "hardware"),
    ).toBe(true);
    expect(
      isPathAllowedForSpace("/application/approvisionnements", "bar_manager", "BOTH", "hardware"),
    ).toBe(true);
    expect(
      isPathAllowedForSpace("/application/inventaires", "bar_manager", "BOTH", "hardware"),
    ).toBe(false);
    expect(canOperateCashRegister("OWNER", "OWNER", "hardware")).toBe(true);
    expect(canOperateCashRegister("OWNER", "OWNER")).toBe(false);
    expect(resolveHomePathForRoles("BAR_MANAGER", "BAR_MANAGER", "hardware")).toBe(
      "/application/stock",
    );
  });
});

describe("client admin server-only", () => {
  it("26. aucune clé secrète exposée via NEXT_PUBLIC", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY).toBeUndefined();
    expect(process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
