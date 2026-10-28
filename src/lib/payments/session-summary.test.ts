import { describe, expect, it } from "vitest";

import {
  DELIVERY_FEE_PAYMENT_PROVIDER,
  summarizeSessionPayments,
} from "@/lib/payments/session-summary";

describe("bilan de session de caisse", () => {
  it("livraison 1 000 F avec 300 F de frais : CA 1 000, attendu 700 en espèces", () => {
    const summary = summarizeSessionPayments([
      {
        method: "OTHER",
        amount_applied: 300,
        provider: DELIVERY_FEE_PAYMENT_PROVIDER,
        transaction_reference: "L-0005",
      },
      { method: "CASH", amount_applied: 700 },
    ]);
    expect(summary.salesTotal).toBe(1000);
    expect(summary.cashCollected).toBe(700);
    expect(summary.deliveryFeesTotal).toBe(300);
    expect(summary.deliveryFees).toEqual([{ reference: "L-0005", amount: 300 }]);
  });

  it("liste les frais commande par commande et ignore les autres paiements « Autre »", () => {
    const summary = summarizeSessionPayments([
      { method: "OTHER", amount_applied: 500, provider: DELIVERY_FEE_PAYMENT_PROVIDER, transaction_reference: "L-0007" },
      { method: "OTHER", amount_applied: 300, provider: DELIVERY_FEE_PAYMENT_PROVIDER, transaction_reference: "L-0006" },
      { method: "OTHER", amount_applied: 2000, provider: "Bon d'achat" },
      { method: "ORANGE_MONEY", amount_applied: 1500 },
      { method: "CASH", amount_applied: 4000 },
    ]);
    expect(summary.deliveryFees.map((fee) => fee.reference)).toEqual(["L-0006", "L-0007"]);
    expect(summary.deliveryFeesTotal).toBe(800);
    expect(summary.cashCollected).toBe(4000);
    expect(summary.salesTotal).toBe(8300);
  });
});
