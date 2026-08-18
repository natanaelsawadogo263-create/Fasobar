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
  it("masque Stock boissons en quincaillerie", () => {
    const ids = reportOptionsForScope("BOTH", "hardware").map((option) => option.id);
    expect(ids).not.toContain("stock_boissons");
  });

  it("garde Stock boissons pour un restaurant avec bar", () => {
    const ids = reportOptionsForScope("BOTH", "restaurant").map((option) => option.id);
    expect(ids).toContain("stock_boissons");
  });
});
