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
        idempotency_key: "delivery-aaaa-bbbb-fee",
      },
      { method: "CASH", amount_applied: 700, idempotency_key: "delivery-aaaa-bbbb", notes: "Livraison L-0005" },
    ]);
    expect(summary.salesTotal).toBe(1000);
    expect(summary.cashCollected).toBe(700);
    expect(summary.deliveryFeesTotal).toBe(300);
    expect(summary.deliveries).toEqual([{ reference: "L-0005", total: 1000, fee: 300, received: 700 }]);
    expect(summary.onSiteSalesTotal).toBe(0);
  });

  it("sépare ventes sur place et livrées, et ignore les autres paiements « Autre »", () => {
    const summary = summarizeSessionPayments([
      { method: "OTHER", amount_applied: 500, provider: DELIVERY_FEE_PAYMENT_PROVIDER, transaction_reference: "L-0007", idempotency_key: "delivery-7-fee" },
      { method: "CASH", amount_applied: 2500, idempotency_key: "delivery-7", notes: "Livraison L-0007" },
      { method: "OTHER", amount_applied: 300, provider: DELIVERY_FEE_PAYMENT_PROVIDER, transaction_reference: "L-0006", idempotency_key: "delivery-6-fee" },
      { method: "OTHER", amount_applied: 2000, provider: "Bon d'achat", order_id: "o1" },
      { method: "ORANGE_MONEY", amount_applied: 1500, order_id: "o2" },
      { method: "CASH", amount_applied: 4000, order_id: "o2" },
    ]);
    expect(summary.deliveries.map((delivery) => delivery.reference)).toEqual(["L-0006", "L-0007"]);
    expect(summary.deliveryFeesTotal).toBe(800);
    expect(summary.deliverySalesTotal).toBe(3300);
    expect(summary.onSiteSalesCount).toBe(2);
    expect(summary.onSiteSalesTotal).toBe(7500);
    expect(summary.cashCollected).toBe(6500);
    expect(summary.salesTotal).toBe(10800);
  });
});
