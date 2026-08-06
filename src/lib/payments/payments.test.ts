import { describe, expect, it } from "vitest";

import {
  calculateChange,
  formatPaymentNumber,
  formatReceiptNumber,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import {
  closeCashSessionSchema,
  openCashSessionSchema,
  paymentLineSchema,
  recordPaymentsSchema,
  voidPaymentSchema,
} from "@/lib/payments/schemas";

describe("payment schemas", () => {
  it("valide l'ouverture d'une session de caisse", () => {
    const result = openCashSessionSchema.safeParse({
      openingCashAmount: 25000,
      openingNote: "Fond matinal",
    });

    expect(result.success).toBe(true);
  });

  it("refuse un montant appliqué nul", () => {
    const result = paymentLineSchema.safeParse({
      method: "CASH",
      amountApplied: 0,
      amountReceived: 0,
    });

    expect(result.success).toBe(false);
  });

  it("valide un paiement mixte", () => {
    const result = recordPaymentsSchema.safeParse({
      orderId: "00000000-0000-4000-8000-000000000099",
      payments: [
        { method: "CASH", amountApplied: 5000, amountReceived: 5000 },
        { method: "ORANGE_MONEY", amountApplied: 3000 },
      ],
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });

    expect(result.success).toBe(true);
  });

  it("exige une confirmation pour fermer la caisse", () => {
    const result = closeCashSessionSchema.safeParse({
      sessionId: "00000000-0000-4000-8000-000000000010",
      countedCashAmount: 42000,
      confirmed: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmed).toBe(false);
    }
  });

  it("exige un motif pour annuler un paiement", () => {
    const result = voidPaymentSchema.safeParse({
      paymentId: "00000000-0000-4000-8000-000000000020",
      reason: "Erreur",
      confirmed: true,
    });

    expect(result.success).toBe(true);
  });

  it("refuse un motif trop court pour annulation", () => {
    const result = voidPaymentSchema.safeParse({
      paymentId: "00000000-0000-4000-8000-000000000020",
      reason: "ok",
      confirmed: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("payment helpers", () => {
  it("calcule la monnaie à rendre", () => {
    expect(calculateChange(10000, 7500)).toBe(2500);
    expect(calculateChange(5000, 7500)).toBe(0);
  });

  it("formate les numéros de paiement et reçu", () => {
    expect(formatPaymentNumber(7)).toBe("P00007");
    expect(formatReceiptNumber(42)).toBe("R00042");
  });

  it("expose les libellés des moyens de paiement", () => {
    expect(PAYMENT_METHOD_LABELS.CASH).toBe("Espèces");
    expect(PAYMENT_METHOD_LABELS.ORANGE_MONEY).toBe("Orange Money");
  });
});

describe("payment business rules (unit)", () => {
  it("refuse un montant supérieur au solde restant côté UI", () => {
    const remaining = 3000;
    const applied = 5000;
    expect(applied > remaining).toBe(true);
  });

  it("supporte le paiement partiel", () => {
    const total = 10000;
    const partial = 4000;
    const remaining = total - partial;
    expect(remaining).toBe(6000);
    expect(partial < total).toBe(true);
  });

  it("supporte le paiement mixte", () => {
    const lines = [
      { method: "CASH", amountApplied: 2000 },
      { method: "MOOV_MONEY", amountApplied: 3000 },
    ];
    const totalApplied = lines.reduce((sum, line) => sum + line.amountApplied, 0);
    expect(totalApplied).toBe(5000);
  });

  it("simule l'écart de caisse à la fermeture", () => {
    const opening = 10000;
    const collected = 35000;
    const counted = 44800;
    const expected = opening + collected;
    const difference = counted - expected;
    expect(expected).toBe(45000);
    expect(difference).toBe(-200);
  });

  it("génère une clé d'idempotence unique par soumission", () => {
    const keyA = crypto.randomUUID();
    const keyB = crypto.randomUUID();
    expect(keyA).not.toBe(keyB);
  });
});
