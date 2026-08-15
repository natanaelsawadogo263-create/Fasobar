import { describe, expect, it } from "vitest";

import { getActivityPages } from "@/lib/activity/pages";

describe("pages métier commerce", () => {
  it("adapte pharmacie : tickets, vente, officine", () => {
    const pages = getActivityPages("pharmacy");
    expect(pages.retail).toBe(true);
    expect(pages.tickets.title).toBe("Tickets");
    expect(pages.openTickets.newButton).toBe("Nouvelle vente");
    expect(pages.pos.cartTab).toBe("Vente");
    expect(pages.pos.additionLabel).toBe("Ticket");
    expect(pages.supply.spaceLabel).toBe("Officine");
    expect(pages.reports.stockLabel.toLowerCase()).toContain("officine");
  });

  it("adapte boutique vêtements", () => {
    const pages = getActivityPages("clothing");
    expect(pages.sales.productsTab).toBe("Collections");
    expect(pages.tickets.clientColumn).toBe("Client");
    expect(pages.tickets.searchPlaceholder).toContain("client");
  });

  it("adapte dépôt matériaux", () => {
    const pages = getActivityPages("construction");
    expect(pages.supply.spaceLabel).toBe("Dépôt");
    expect(pages.profile.stockNavLabel).toBe("Dépôt");
  });

  it("adapte supermarché : tickets et rayon", () => {
    const pages = getActivityPages("supermarket");
    expect(pages.pos.productsTab).toBe("Articles");
    expect(pages.supply.spaceLabel).toBe("Rayon");
    expect(pages.cash.orderColumn).toBe("Ticket");
    expect(pages.expenses.kitchenPurchase).toBe("Achats magasin");
  });

  it("adapte la quincaillerie : vente, caisse-vendeur", () => {
    const pages = getActivityPages("hardware");
    expect(pages.retail).toBe(true);
    expect(pages.profile.cashierSpaceLabel).toBe("Caisse-Vendeur");
    expect(pages.pos.cartTab).toBe("Vente");
    expect(pages.pos.productsTab).toBe("Produits");
  });

  it("ne change pas l’espace restauration", () => {
    const pages = getActivityPages("restaurant");
    expect(pages.retail).toBe(false);
    expect(pages.tickets.title).toBe("Commandes");
    expect(pages.pos.cartTab).toBe("Commande");
    expect(pages.pos.additionLabel).toBe("Addition");
    expect(pages.expenses.caisseArea).toBe("Cuisine");
    expect(pages.expenses.barArea).toBe("Bar");
  });
});
