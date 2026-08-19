import { describe, expect, it } from "vitest";

import {
  getActivityProfile,
  getInvitableSpacesForActivity,
  isRetailActivity,
} from "@/lib/activity/profile";

describe("profils d’activité FasoBar", () => {
  it("traite le restaurant comme restauration", () => {
    const profile = getActivityProfile("restaurant");
    expect(profile.kind).toBe("food_service");
    expect(profile.cashierSpaceLabel).toBe("Cuisine");
    expect(profile.ticketsNavLabel).toBe("Commandes");
    expect(isRetailActivity("restaurant")).toBe(false);
  });

  it("adapte le supermarché / alimentation", () => {
    const profile = getActivityProfile("supermarket");
    expect(profile.kind).toBe("retail");
    expect(profile.productNavLabel).toBe("Produits");
    expect(profile.cashierNavLabel).toBe("Caisse");
    expect(profile.catalogDepartmentLabel).toBe("Magasin");
    expect(profile.cashierSpaceLabel).toBe("Caissier");
    expect(profile.stockManagerLabel).toBe("Responsable magasin");
    expect(isRetailActivity("supermarket")).toBe(true);
  });

  it("invite un responsable magasin en supermarché", () => {
    const spaces = getInvitableSpacesForActivity("supermarket", "BOTH");
    expect(spaces.find((item) => item.id === "cashier_kitchen")?.label).toBe(
      "Caissier",
    );
    expect(spaces.find((item) => item.id === "bar_manager")?.label).toBe(
      "Responsable magasin",
    );
  });

  it("adapte la pharmacie en magasin", () => {
    const profile = getActivityProfile("pharmacy");
    expect(profile.kind).toBe("retail");
    expect(profile.catalogDepartmentLabel).toBe("Officine");
    expect(profile.cashierSpaceLabel).toBe("Caissier");
    expect(profile.ticketsNavLabel).toBe("Ventes");
    expect(isRetailActivity("pharmacy")).toBe(true);
  });

  it("invite un responsable stock dans tout magasin", () => {
    const spaces = getInvitableSpacesForActivity("pharmacy", "BOTH");
    expect(spaces.map((item) => item.id)).toEqual([
      "admin",
      "cashier_kitchen",
      "bar_manager",
    ]);
    expect(spaces.find((item) => item.id === "cashier_kitchen")?.label).toBe(
      "Caissier",
    );
    expect(spaces.find((item) => item.id === "bar_manager")?.label).toBe(
      "Responsable officine",
    );
  });

  it("invite un responsable stock en quincaillerie", () => {
    const spaces = getInvitableSpacesForActivity("hardware", "BOTH");
    expect(spaces.map((item) => item.id)).toEqual([
      "admin",
      "cashier_kitchen",
      "bar_manager",
    ]);
    expect(spaces.find((item) => item.id === "cashier_kitchen")?.label).toBe(
      "Caisse-Vendeur",
    );
    expect(spaces.find((item) => item.id === "bar_manager")?.label).toBe(
      "Responsable Stock",
    );
  });

  it("conserve le bar pour un restaurant", () => {
    const spaces = getInvitableSpacesForActivity("restaurant", "BOTH");
    expect(spaces.map((item) => item.id)).toEqual([
      "admin",
      "cashier_kitchen",
      "bar_manager",
    ]);
    expect(spaces.find((item) => item.id === "cashier_kitchen")?.label).toBe("Cuisine");
    expect(spaces.find((item) => item.id === "bar_manager")?.label).toBe("Bar");
  });

  it("retombe sur restaurant si le code est inconnu", () => {
    expect(getActivityProfile(null).id).toBe("restaurant");
    expect(getActivityProfile("inconnu").kind).toBe("food_service");
  });
});
