import { describe, expect, it } from "vitest";

import { FALLBACK_PUBLIC_PLANS } from "@/lib/marketing/plan-constants";

describe("offres publiques", () => {
  it("reprend les tarifs seed FasoBar", () => {
    expect(FALLBACK_PUBLIC_PLANS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MONTHLY", priceXof: 10_000 }),
        expect.objectContaining({ code: "YEARLY", priceXof: 100_000 }),
      ]),
    );
  });
});
