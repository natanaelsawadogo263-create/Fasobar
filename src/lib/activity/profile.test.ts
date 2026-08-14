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
    expect(profile.cashierSpaceLabel).toBe("Caisse–Cuisine");
    expect(profile.ticketsNavLabel).toBe("Commandes");
    expect(isRetailActivity("restaurant")).toBe(false);
  });

  it("adapte la pharmacie en magasin", () => {
    const profile = getActivityProfile("pharmacy");
    expect(profile.kind).toBe("retail");
    expect(profile.catalogDepartmentLabel).toBe("Officine");
    expect(profile.cashierSpaceLabel).toBe("Caissier");
    expect(profile.ticketsNavLabel).toBe("Tickets");
    expect(isRetailActivity("pharmacy")).toBe(true);
  });

  it("n’invite pas de responsable bar en commerce classique", () => {
    const spaces = getInvitableSpacesForActivity("pharmacy", "BOTH");
    expect(spaces.map((item) => item.id)).toEqual(["admin", "cashier_kitchen"]);
    expect(spaces.find((item) => item.id === "cashier_kitchen")?.label).toBe(
      "Caissier",
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
  });

  it("retombe sur restaurant si le code est inconnu", () => {
    expect(getActivityProfile(null).id).toBe("restaurant");
    expect(getActivityProfile("inconnu").kind).toBe("food_service");
  });
});
