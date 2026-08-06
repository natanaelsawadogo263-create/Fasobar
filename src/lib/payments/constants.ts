import type { PaymentMethod } from "@/lib/payments/schemas";

export { formatPriceXof } from "@/lib/products/constants";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  TELECEL_MONEY: "Telecel Money",
  CARD: "Carte",
  OTHER: "Autre",
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  CASH: "💵",
  ORANGE_MONEY: "🟠",
  MOOV_MONEY: "🔵",
  TELECEL_MONEY: "🟢",
  CARD: "💳",
  OTHER: "📱",
};

export const MOBILE_MONEY_METHODS = new Set<PaymentMethod>([
  "ORANGE_MONEY",
  "MOOV_MONEY",
  "TELECEL_MONEY",
]);

export function formatPaymentNumber(paymentNumber: number): string {
  return `P${String(paymentNumber).padStart(5, "0")}`;
}

export function formatReceiptNumber(receiptNumber: number): string {
  return `R${String(receiptNumber).padStart(5, "0")}`;
}

export function calculateChange(amountReceived: number, amountApplied: number): number {
  return Math.max(amountReceived - amountApplied, 0);
}
