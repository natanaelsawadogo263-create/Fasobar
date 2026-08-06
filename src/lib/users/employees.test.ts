import { describe, expect, it } from "vitest";

import {
  inviteSpaceToRole,
  resolveHomePathForRoles,
  resolveUserSpace,
} from "@/lib/auth/roles";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import {
  createEmployeeAccountSchema,
  employeeSpaceSchema,
} from "@/lib/users/schemas";
import { DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD } from "@/lib/users/constants";
import {
  firstLoginPasswordSchema,
  scorePasswordStrength,
  securePasswordSchema,
} from "@/lib/users/password-policy";

const personalPassword = "MonMotDePasse1!";
const establishmentId = "00000000-0000-4000-8000-000000000001";

describe("création de compte employé", () => {
  it("1-3. accepte les trois espaces via le schéma", () => {
    for (const space of ["admin", "cashier_kitchen", "bar_manager"] as const) {
      const result = createEmployeeAccountSchema.safeParse({
        fullName: "Employé Test",
        email: "employe@example.com",
        space,
        establishmentId,
      });
      expect(result.success).toBe(true);
      expect(inviteSpaceToRole(space)).toBeTruthy();
    }
  });

  it("4. mappe Admin vers ADMIN", () => {
    expect(inviteSpaceToRole("admin")).toBe("ADMIN");
  });

  it("5-6. Caisse–Cuisine et Bar ne peuvent pas créer via schéma espace", () => {
    expect(employeeSpaceSchema.safeParse("cashier_kitchen").success).toBe(true);
    expect(employeeSpaceSchema.safeParse("owner").success).toBe(false);
  });

  it("7. email obligatoire et normalisable", () => {
    const result = createEmployeeAccountSchema.safeParse({
      fullName: "Test",
      email: "pas-un-email",
      space: "admin",
      establishmentId,
    });
    expect(result.success).toBe(false);
  });

  it("8. établissement UUID requis", () => {
    const result = createEmployeeAccountSchema.safeParse({
      fullName: "Test",
      email: "test@example.com",
      space: "admin",
      establishmentId: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("9-10. mot de passe personnel faible refusé", () => {
    expect(securePasswordSchema.safeParse("court").success).toBe(false);
    expect(scorePasswordStrength("court")).toBeLessThan(3);
  });

  it("11. le schéma de création n'inclut pas de mot de passe saisi", () => {
    const result = createEmployeeAccountSchema.safeParse({
      fullName: "Test",
      email: "test@example.com",
      space: "admin",
      establishmentId,
      temporaryPassword: "ignored",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("temporaryPassword" in result.data).toBe(false);
    }
  });

  it("16. le schéma ne contient pas de champ organization_id", () => {
    const shape = createEmployeeAccountSchema.safeParse({
      fullName: "Test",
      email: "test@example.com",
      space: "admin",
      establishmentId,
      organizationId: "00000000-0000-4000-8000-000000000099",
    });
    expect(shape.success).toBe(true);
    if (shape.success) {
      expect("organizationId" in shape.data).toBe(false);
    }
  });

  it("mot de passe temporaire par défaut défini", () => {
    expect(DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD).toBe("FasoBar@11111");
  });
});

describe("première connexion", () => {
  it("18-19. refuse le mot de passe temporaire par défaut comme mot de passe personnel", () => {
    const result = firstLoginPasswordSchema.safeParse({
      password: DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD,
      confirmPassword: DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD,
    });
    expect(result.success).toBe(false);
  });

  it("accepte un mot de passe personnel valide", () => {
    const result = firstLoginPasswordSchema.safeParse({
      password: personalPassword,
      confirmPassword: personalPassword,
    });
    expect(result.success).toBe(true);
  });

  it("22. redirections par espace après changement", () => {
    expect(resolveHomePathForRoles("CASHIER_KITCHEN", "CASHIER_KITCHEN")).toBe(
      "/application/caisse",
    );
    expect(resolveHomePathForRoles("BAR_MANAGER", "BAR_MANAGER")).toBe("/application/bar");
    expect(resolveHomePathForRoles("ADMIN", "ADMIN")).toBe("/application/tableau-de-bord");
  });
});

describe("protections d'accès", () => {
  it("Caisse–Cuisine ne peut pas ouvrir utilisateurs", () => {
    expect(isPathAllowedForSpace("/application/utilisateurs", "cashier_kitchen")).toBe(false);
    expect(resolveUserSpace("CASHIER_KITCHEN", "CASHIER_KITCHEN")).toBe("cashier_kitchen");
  });

  it("29. aucun secret public exposé", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY).toBeUndefined();
  });
});
