/** Quantité affichée sur un ticket bar / cuisine (delta, pas toute la commande). */

export function stationLineQuantity(params: {
  quantity: number;
  preparedQuantity: number;
  /** À préparer / en préparation : seulement le reliquat. */
  activePrep: boolean;
}): number | null {
  const quantity = Number(params.quantity);
  const prepared = Math.max(0, Number(params.preparedQuantity) || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  if (params.activePrep) {
    const pending = quantity - prepared;
    return pending > 0 ? pending : null;
  }

  const shown = prepared > 0 ? prepared : quantity;
  return shown > 0 ? shown : null;
}

export function stationLineTotal(unitPrice: number, quantity: number): number {
  return Math.round(Number(unitPrice) * Number(quantity));
}

export function isStationSupplement(
  items: Array<{ preparedQuantity: number }>,
  activePrep: boolean,
): boolean {
  return activePrep && items.some((item) => Number(item.preparedQuantity) > 0);
}
