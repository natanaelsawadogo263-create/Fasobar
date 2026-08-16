import { toStockQuantity } from "@/lib/hardware/product-engine";

/** Détail caisse : montant payé / prix de l’unité de stock. */
export function stockQtyFromAmount(amount: number, unitPrice: number): number {
  if (!(amount > 0) || !(unitPrice > 0)) return 0;
  return Math.round((amount / unitPrice) * 1000) / 1000;
}

/** Identité d’une ligne ticket : produit + unité de vente. */
export function saleLineKey(
  productId: string,
  saleUnitId?: string | null,
): string {
  return `${productId}::${saleUnitId ?? ""}`;
}

export type SaleLineSnapshot = {
  productId: string;
  saleUnitId: string | null;
  saleUnitName: string;
  unitPrice: number;
  quantity: number;
  conversionFactor: number;
  stockQuantity: number;
};

export function snapshotSaleLine(input: {
  productId: string;
  saleUnitId?: string | null;
  saleUnitName: string;
  unitPrice: number;
  quantity: number;
  conversionFactor: number;
}): SaleLineSnapshot {
  const conversionFactor =
    Number.isFinite(input.conversionFactor) && input.conversionFactor > 0
      ? input.conversionFactor
      : 1;
  return {
    productId: input.productId,
    saleUnitId: input.saleUnitId ?? null,
    saleUnitName: input.saleUnitName,
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    conversionFactor,
    stockQuantity: toStockQuantity(input.quantity, conversionFactor),
  };
}

export function canShareTicket(
  a: { productId: string; saleUnitId?: string | null },
  b: { productId: string; saleUnitId?: string | null },
): boolean {
  return (
    a.productId === b.productId &&
    saleLineKey(a.productId, a.saleUnitId) !==
      saleLineKey(b.productId, b.saleUnitId)
  );
}

export type StockLedger = Map<string, number>;

export type ApplySaleStockResult =
  | { ok: true; ledger: StockLedger; posted: true }
  | { ok: false; error: string; ledger: StockLedger };

/**
 * Débite le stock (unité de stock) à partir des snapshots de lignes.
 * Ne mute pas `ledger` : en cas d’échec, le map d’origine est renvoyé.
 * `alreadyPosted` : seconde validation — aucun débit.
 */
export function applySaleStockDebits(
  ledger: StockLedger,
  lines: Array<Pick<SaleLineSnapshot, "productId" | "stockQuantity">>,
  options?: { alreadyPosted?: boolean },
): ApplySaleStockResult {
  if (options?.alreadyPosted) {
    return { ok: true, ledger: new Map(ledger), posted: true };
  }

  const next = new Map(ledger);

  for (const line of lines) {
    if (!(line.stockQuantity > 0)) continue;
    if (!next.has(line.productId)) continue;
    const before = next.get(line.productId) ?? 0;
    const after = Math.round((before - line.stockQuantity) * 1000) / 1000;
    if (after < 0) {
      return {
        ok: false,
        error: "Stock insuffisant pour enregistrer cette vente.",
        ledger: new Map(ledger),
      };
    }
    next.set(line.productId, after);
  }

  return { ok: true, ledger: next, posted: true };
}

export function paymentAlreadySettled(paymentStatus: string): boolean {
  return paymentStatus === "PAID";
}
