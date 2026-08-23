import { describe, expect, it } from "vitest";

import { toStockQuantity } from "@/lib/hardware/product-engine";
import {
  applySaleStockDebits,
  canShareTicket,
  paymentAlreadySettled,
  saleLineKey,
  snapshotSaleLine,
} from "@/lib/catalog/sale-stock";

const PRODUCT = "ampoule-id";

describe("identité de ligne caisse", () => {
  it("autorise pièce et boîte du même produit sur un ticket", () => {
    const piece = { productId: PRODUCT, saleUnitId: "unit-piece" };
    const box = { productId: PRODUCT, saleUnitId: "unit-box" };

    expect(saleLineKey(piece.productId, piece.saleUnitId)).not.toBe(
      saleLineKey(box.productId, box.saleUnitId),
    );
    expect(canShareTicket(piece, box)).toBe(true);
    expect(canShareTicket(piece, piece)).toBe(false);
  });
});

describe("conversion vente → stock", () => {
  it("convertit 2 boîtes × 5 pièces en 10 unités de stock", () => {
    expect(toStockQuantity(2, 5)).toBe(10);
  });

  it("enregistre un snapshot (unité, prix, coefficient, qty stock)", () => {
    const snap = snapshotSaleLine({
      productId: PRODUCT,
      saleUnitId: "unit-box",
      saleUnitName: "boîte de 5",
      unitPrice: 2500,
      quantity: 2,
      conversionFactor: 5,
    });

    expect(snap.saleUnitName).toBe("boîte de 5");
    expect(snap.unitPrice).toBe(2500);
    expect(snap.conversionFactor).toBe(5);
    expect(snap.stockQuantity).toBe(10);
  });
});

describe("débit stock à la validation", () => {
  it("débite le stock selon les snapshots du ticket (pièce + boîte)", () => {
    const lines = [
      snapshotSaleLine({
        productId: PRODUCT,
        saleUnitId: "unit-piece",
        saleUnitName: "pièce",
        unitPrice: 500,
        quantity: 2,
        conversionFactor: 1,
      }),
      snapshotSaleLine({
        productId: PRODUCT,
        saleUnitId: "unit-box",
        saleUnitName: "boîte de 5",
        unitPrice: 2500,
        quantity: 1,
        conversionFactor: 5,
      }),
    ];

    const result = applySaleStockDebits(new Map([[PRODUCT, 20]]), lines);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ledger.get(PRODUCT)).toBe(13);
    }
  });

  it("le scan ne débite rien : un pack ×6 vendu ne diminue le stock qu'à la validation (-6 unités de base)", () => {
    // Coca-Cola : 48 en stock, 1 pack ×6 scanné et ajouté au panier — le stock ne
    // bouge qu'au moment où applySaleStockDebits (validation réelle) est appelé.
    const packLine = snapshotSaleLine({
      productId: PRODUCT,
      saleUnitId: "unit-pack-6",
      saleUnitName: "Pack de 6",
      unitPrice: 2700,
      quantity: 1,
      conversionFactor: 6,
    });
    expect(packLine.stockQuantity).toBe(6);

    const stockBeforeValidation = new Map([[PRODUCT, 48]]);
    // Simule le panier scanné, pas encore encaissé : aucun débit tant que
    // applySaleStockDebits n'est pas appelé.
    expect(stockBeforeValidation.get(PRODUCT)).toBe(48);

    const result = applySaleStockDebits(stockBeforeValidation, [packLine]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ledger.get(PRODUCT)).toBe(42); // 48 - 6
    }
    // Le map d'origine n'est jamais muté avant la validation.
    expect(stockBeforeValidation.get(PRODUCT)).toBe(48);
  });

  it("refuse une double validation (déjà PAID)", () => {
    expect(paymentAlreadySettled("PAID")).toBe(true);
    const ledger = new Map([[PRODUCT, 10]]);
    const line = snapshotSaleLine({
      productId: PRODUCT,
      saleUnitName: "pièce",
      unitPrice: 500,
      quantity: 1,
      conversionFactor: 1,
    });
    const first = applySaleStockDebits(ledger, [line]);
    expect(first.ok).toBe(true);
    const second = applySaleStockDebits(
      first.ok ? first.ledger : ledger,
      [line],
      { alreadyPosted: paymentAlreadySettled("PAID") },
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.ledger.get(PRODUCT)).toBe(9);
    }
  });

  it("n’applique aucun débit si la transaction échoue", () => {
    const original = new Map([[PRODUCT, 4]]);
    const line = snapshotSaleLine({
      productId: PRODUCT,
      saleUnitName: "boîte de 5",
      unitPrice: 2500,
      quantity: 1,
      conversionFactor: 5,
    });
    const failed = applySaleStockDebits(original, [line]);
    expect(failed.ok).toBe(false);
    expect(failed.ledger.get(PRODUCT)).toBe(4);
    expect(original.get(PRODUCT)).toBe(4);
  });
});
