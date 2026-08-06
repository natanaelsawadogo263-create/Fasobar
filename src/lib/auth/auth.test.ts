import { describe, expect, it } from "vitest";

import {
  getBootstrapBlockedMessage,
  isProtectedPath,
  resolvePostLoginPath,
  shouldRedirectAuthenticatedFromAuth,
  shouldRedirectUnauthenticated,
} from "@/lib/auth/routes";
import { onboardingSchema, signUpSchema } from "@/lib/auth/schemas";
import { isValidSlug, normalizeSlug, slugifyFromName } from "@/lib/auth/slugs";

describe("signUpSchema", () => {
  it("accepte un formulaire valide", () => {
    const result = signUpSchema.safeParse({
      fullName: "Awa Ouédraogo",
      email: "awa@example.com",
      password: "motdepasse10",
      confirmPassword: "motdepasse10",
      acceptTerms: true,
    });

    expect(result.success).toBe(true);
  });

  it("refuse un mot de passe trop court", () => {
    const result = signUpSchema.safeParse({
      fullName: "Awa Ouédraogo",
      email: "awa@example.com",
      password: "court",
      confirmPassword: "court",
      acceptTerms: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  it("accepte un onboarding valide", () => {
    const result = onboardingSchema.safeParse({
      organizationName: "Maquis Le Palmier",
      organizationSlug: "maquis-le-palmier",
      establishmentName: "Le Palmier Ouaga",
      establishmentSlug: "le-palmier-ouaga",
      establishmentType: "RESTAURANT_MAQUIS",
      city: "Ouagadougou",
      country: "Burkina Faso",
      currency: "XOF",
      timezone: "Africa/Ouagadougou",
    });

    expect(result.success).toBe(true);
  });

  it("refuse un slug invalide", () => {
    const result = onboardingSchema.safeParse({
      organizationName: "Test",
      organizationSlug: "Slug Invalide",
      establishmentName: "Bar Test",
      establishmentSlug: "bar-test",
      establishmentType: "BAR",
      city: "Ouagadougou",
    });

    expect(result.success).toBe(false);
  });
});

describe("slugs", () => {
  it("normalise un slug", () => {
    expect(normalizeSlug("  Maquis Le Palmier  ")).toBe("maquis-le-palmier");
  });

  it("génère un slug depuis un nom", () => {
    expect(slugifyFromName("Restaurant Étoile")).toBe("restaurant-etoile");
  });

  it("valide le format de slug", () => {
    expect(isValidSlug("fasobar-dev")).toBe(true);
    expect(isValidSlug("Slug Invalide")).toBe(false);
  });
});

describe("routes et redirections", () => {
  it("protège les routes applicatives", () => {
    expect(isProtectedPath("/application")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/platform")).toBe(true);
    expect(isProtectedPath("/acces-refuse")).toBe(true);
    expect(isProtectedPath("/acces-suspendu")).toBe(true);
    expect(isProtectedPath("/connexion")).toBe(false);
  });

  it("redirige un visiteur non connecté", () => {
    expect(shouldRedirectUnauthenticated("/application", false)).toBe(true);
    expect(shouldRedirectUnauthenticated("/platform", false)).toBe(true);
    expect(shouldRedirectUnauthenticated("/connexion", false)).toBe(false);
  });

  it("redirige un utilisateur connecté hors de la connexion", () => {
    expect(shouldRedirectAuthenticatedFromAuth("/connexion", true)).toBe(true);
    expect(shouldRedirectAuthenticatedFromAuth("/inscription", true)).toBe(true);
    expect(shouldRedirectAuthenticatedFromAuth("/mot-de-passe-oublie", true)).toBe(false);
  });

  it("choisit la bonne destination après connexion", () => {
    expect(resolvePostLoginPath(false)).toBe("/onboarding");
    expect(resolvePostLoginPath(true)).toBe("/application");
    expect(resolvePostLoginPath(false, true)).toBe("/platform");
    expect(resolvePostLoginPath(true, true)).toBe("/platform");
  });

  it("refuse un second bootstrap", () => {
    expect(getBootstrapBlockedMessage(true)).toBe(
      "Vous avez déjà configuré une organisation.",
    );
    expect(getBootstrapBlockedMessage(false)).toBeNull();
  });
});
