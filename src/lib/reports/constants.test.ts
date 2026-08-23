import { describe, expect, it } from "vitest";

import {
  humanizeActionCode,
  humanizeEntityType,
  reportOptionsForScope,
} from "@/lib/reports/constants";

describe("libellés d’audit", () => {
  it("traduit les actions en français", () => {
    expect(humanizeActionCode("CASH_SESSION_CLOSED")).toBe("Caisse fermée");
    expect(humanizeActionCode("EXPENSE_CREATED")).toBe("Dépense créée");
  });

  it("traduit le type d’entité selon l’action", () => {
    expect(humanizeEntityType("payment", "CASH_SESSION_CLOSED")).toBe("Caisse");
    expect(humanizeEntityType("expense", "EXPENSE_CREATED")).toBe("Dépense");
  });
});

describe("catalogue des rapports", () => {
  it("renomme Stock boissons en Stock magasin en quincaillerie (même rapport, activité commerce)", () => {
    const options = reportOptionsForScope("BOTH", "hardware");
    const option = options.find((item) => item.id === "stock_boissons");
    expect(option?.label).toBe("Stock magasin");
  });

  it("renomme Stock boissons en Stock magasin en Alimentation (supermarché)", () => {
    const options = reportOptionsForScope("BOTH", "supermarket");
    const option = options.find((item) => item.id === "stock_boissons");
    expect(option?.label).toBe("Stock magasin");
  });

  it("garde le libellé Stock boissons pour un restaurant avec bar", () => {
    const options = reportOptionsForScope("BOTH", "restaurant");
    const option = options.find((item) => item.id === "stock_boissons");
    expect(option?.label).toBe("Stock boissons");
  });

  it("masque Stock boissons pour un restaurant sans service bar (cuisine seule)", () => {
    const ids = reportOptionsForScope("KITCHEN", "restaurant").map((option) => option.id);
    expect(ids).not.toContain("stock_boissons");
  });
});
