import { describe, expect, it } from "vitest";

import { humanizeActionCode, humanizeEntityType } from "@/lib/reports/constants";

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
