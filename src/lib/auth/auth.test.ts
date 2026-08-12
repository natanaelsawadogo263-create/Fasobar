import { describe, expect, it } from "vitest";

import {
  getBootstrapBlockedMessage,
  isAuthRoute,
  isProtectedPath,
  resolvePostLoginPath,
  shouldRedirectAuthenticatedFromAuth,
  shouldRedirectUnauthenticated,
} from "@/lib/auth/routes";
import { onboardingSchema, signUpSchema } from "@/lib/auth/schemas";
import { isValidSlug, normalizeSlug, slugifyFromName, withUniqueSlugSuffix } from "@/lib/auth/slugs";

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
      activityCode: "restaurant",
      city: "Ouagadougou",
      address: "Ouaga 2000",
      country: "Burkina Faso",
      currency: "XOF",
      timezone: "Africa/Ouagadougou",
    });

    expect(result.success).toBe(true);
  });

  it("refuse une activité pas encore disponible", () => {
    const result = onboardingSchema.safeParse({
      organizationName: "Pharmacie du Centre",
      organizationSlug: "pharmacie-du-centre",
      establishmentName: "Pharmacie du Centre",
      establishmentSlug: "pharmacie-du-centre",
      activityCode: "pharmacy",
      city: "Ouagadougou",
      address: "Zone 1",
      country: "Burkina Faso",
      currency: "XOF",
      timezone: "Africa/Ouagadougou",
    });

    expect(result.success).toBe(false);
  });

  it("refuse sans ville ou quartier", () => {
    const result = onboardingSchema.safeParse({
      organizationName: "Maquis Le Palmier",
      organizationSlug: "maquis-le-palmier",
      establishmentName: "Le Palmier Ouaga",
      establishmentSlug: "le-palmier-ouaga",
      activityCode: "restaurant",
      city: "",
      address: "",
    });

    expect(result.success).toBe(false);
  });

  it("refuse un slug invalide", () => {
    const result = onboardingSchema.safeParse({
      organizationName: "Test",
      organizationSlug: "Slug Invalide",
      establishmentName: "Bar Test",
      establishmentSlug: "bar-test",
      activityCode: "restaurant",
      city: "Ouagadougou",
      address: "Zone 1",
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

  it("ajoute un suffixe unique à un slug", () => {
    const result = withUniqueSlugSuffix("maquis", "abc123def");
    expect(result.startsWith("maquis-")).toBe(true);
    expect(isValidSlug(result)).toBe(true);
    expect(result).not.toBe("maquis");
  });
});

describe("routes et redirections", () => {
  it("protège les routes applicatives", () => {
    expect(isProtectedPath("/application")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/platform")).toBe(true);
    expect(isProtectedPath("/abonnement")).toBe(true);
    expect(isProtectedPath("/acces-saas-bloque")).toBe(true);
    expect(isProtectedPath("/acces-refuse")).toBe(true);
    expect(isProtectedPath("/acces-suspendu")).toBe(true);
    expect(isProtectedPath("/connexion")).toBe(false);
    expect(isProtectedPath("/fonctionnalites")).toBe(false);
    expect(isProtectedPath("/tarifs")).toBe(false);
    expect(isProtectedPath("/telecharger")).toBe(false);
    expect(isAuthRoute("/connexion")).toBe(true);
    expect(isAuthRoute("/inscription")).toBe(true);
    expect(isAuthRoute("/inscription/activite")).toBe(true);
    expect(isAuthRoute("/fonctionnalites")).toBe(false);
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
