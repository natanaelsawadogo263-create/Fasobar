/** Fournisseur marquant la part d'une livraison retenue par le livreur (paiement OTHER). */
export const DELIVERY_FEE_PAYMENT_PROVIDER = "Frais livreur";

/** Clé d'idempotence des paiements d'une livraison encaissée (cash_delivery_order). */
const DELIVERY_PAYMENT_KEY_PREFIX = "delivery-";

export type SessionPaymentRow = {
  method: string;
  amount_applied: number;
  provider?: string | null;
  transaction_reference?: string | null;
  order_id?: string | null;
  idempotency_key?: string | null;
  notes?: string | null;
};

/** Une livraison encaissée dans la session. */
export type SessionDelivery = {
  /** Numéro de livraison (L-0005). */
  reference: string;
  /** Prix payé par le client. */
  total: number;
  /** Frais de course gardés par le livreur. */
  fee: number;
  /** Ce que la caisse a reçu. */
  received: number;
};

export type SessionPaymentsSummary = {
  /** Espèces réellement entrées dans le tiroir. */
  cashCollected: number;
  /** Chiffre d'affaires encaissé dans la session (tous modes, frais livreur compris). */
  salesTotal: number;
  /** Ventes faites sur place (hors livraisons). */
  onSiteSalesCount: number;
  onSiteSalesTotal: number;
  /** Livraisons encaissées, une ligne par livraison. */
  deliveries: SessionDelivery[];
  deliverySalesTotal: number;
  deliveryFeesTotal: number;
};

export function isDeliveryFeePayment(row: SessionPaymentRow): boolean {
  return row.method === "OTHER" && row.provider === DELIVERY_FEE_PAYMENT_PROVIDER;
}

/** Identifiant de la livraison d'un paiement, null pour une vente sur place. */
function deliveryKey(row: SessionPaymentRow): string | null {
  const key = row.idempotency_key?.trim();
  if (key?.startsWith(DELIVERY_PAYMENT_KEY_PREFIX)) {
    return key.slice(DELIVERY_PAYMENT_KEY_PREFIX.length).replace(/-fee$/, "");
  }
  if (isDeliveryFeePayment(row)) {
    return row.transaction_reference?.trim() || "Livraison";
  }
  return null;
}

function deliveryReference(row: SessionPaymentRow): string | null {
  if (isDeliveryFeePayment(row) && row.transaction_reference?.trim()) {
    return row.transaction_reference.trim();
  }
  return row.notes?.match(/L-\d+/)?.[0] ?? null;
}

/** Résumé d'une session à partir de ses paiements confirmés. */
export function summarizeSessionPayments(rows: SessionPaymentRow[]): SessionPaymentsSummary {
  let cashCollected = 0;
  let salesTotal = 0;
  let onSiteSalesTotal = 0;
  const onSiteOrders = new Set<string>();
  let onSiteWithoutOrder = 0;
  const deliveries = new Map<string, SessionDelivery>();

  for (const row of rows) {
    const amount = Number(row.amount_applied) || 0;
    salesTotal += amount;
    if (row.method === "CASH") cashCollected += amount;

    const key = deliveryKey(row);
    if (key === null) {
      onSiteSalesTotal += amount;
      if (row.order_id) onSiteOrders.add(row.order_id);
      else onSiteWithoutOrder += 1;
      continue;
    }

    const delivery = deliveries.get(key) ?? { reference: "Livraison", total: 0, fee: 0, received: 0 };
    delivery.total += amount;
    if (isDeliveryFeePayment(row)) delivery.fee += amount;
    else delivery.received += amount;
    const reference = deliveryReference(row);
    if (reference) delivery.reference = reference;
    deliveries.set(key, delivery);
  }

  const deliveryList = [...deliveries.values()].sort((a, b) =>
    a.reference.localeCompare(b.reference),
  );

  return {
    cashCollected,
    salesTotal,
    onSiteSalesCount: onSiteOrders.size + onSiteWithoutOrder,
    onSiteSalesTotal,
    deliveries: deliveryList,
    deliverySalesTotal: deliveryList.reduce((sum, delivery) => sum + delivery.total, 0),
    deliveryFeesTotal: deliveryList.reduce((sum, delivery) => sum + delivery.fee, 0),
  };
}
