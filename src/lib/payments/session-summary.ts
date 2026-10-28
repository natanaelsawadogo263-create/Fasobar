/** Fournisseur marquant la part d'une livraison retenue par le livreur (paiement OTHER). */
export const DELIVERY_FEE_PAYMENT_PROVIDER = "Frais livreur";

export type SessionPaymentRow = {
  method: string;
  amount_applied: number;
  provider?: string | null;
  transaction_reference?: string | null;
};

export type SessionDeliveryFee = {
  /** Numéro de livraison (L-0005). */
  reference: string;
  amount: number;
};

export type SessionPaymentsSummary = {
  /** Espèces réellement entrées dans le tiroir. */
  cashCollected: number;
  /** Chiffre d'affaires encaissé dans la session (tous modes, frais livreur compris). */
  salesTotal: number;
  /** Frais de course gardés par les livreurs, commande par commande. */
  deliveryFees: SessionDeliveryFee[];
  deliveryFeesTotal: number;
};

export function isDeliveryFeePayment(row: SessionPaymentRow): boolean {
  return row.method === "OTHER" && row.provider === DELIVERY_FEE_PAYMENT_PROVIDER;
}

/** Résumé d'une session à partir de ses paiements confirmés. */
export function summarizeSessionPayments(rows: SessionPaymentRow[]): SessionPaymentsSummary {
  let cashCollected = 0;
  let salesTotal = 0;
  const fees = new Map<string, number>();

  for (const row of rows) {
    const amount = Number(row.amount_applied) || 0;
    salesTotal += amount;
    if (row.method === "CASH") cashCollected += amount;
    if (isDeliveryFeePayment(row)) {
      const reference = row.transaction_reference?.trim() || "Livraison";
      fees.set(reference, (fees.get(reference) ?? 0) + amount);
    }
  }

  const deliveryFees = [...fees.entries()]
    .map(([reference, amount]) => ({ reference, amount }))
    .sort((a, b) => a.reference.localeCompare(b.reference));

  return {
    cashCollected,
    salesTotal,
    deliveryFees,
    deliveryFeesTotal: deliveryFees.reduce((sum, fee) => sum + fee.amount, 0),
  };
}
