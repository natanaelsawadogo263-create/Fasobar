import type { PaymentMethod } from "@/lib/payments/schemas";
import type { SessionDeliveryFee } from "@/lib/payments/session-summary";

export type PaymentActionState = {
  error?: string;
  success?: string;
  sessionId?: string;
  receiptId?: string;
  orderId?: string;
  fullyPaid?: boolean;
  changeGiven?: number;
};

export type CashSessionDetail = {
  id: string;
  status: string;
  openingCashAmount: number;
  expectedCashAmount: number;
  countedCashAmount: number | null;
  cashDifference: number | null;
  openingNote: string | null;
  closingNote: string | null;
  openedAt: string;
  closedAt: string | null;
  openedByName: string | null;
  cashCollected: number;
  /** Chiffre d'affaires encaissé dans la session (tous modes). */
  salesTotal: number;
  /** Frais de course gardés par les livreurs, par commande. */
  deliveryFees: SessionDeliveryFee[];
  deliveryFeesTotal: number;
};

export type OrderPaymentSummary = {
  orderId: string;
  orderNumber: number;
  tableReference: string | null;
  customerReference: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  status: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    amountApplied: number;
    amountReceived: number | null;
    changeGiven: number;
    status: string;
    receivedAt: string;
  }>;
};

export type ReceiptDetail = {
  id: string;
  receiptNumber: number;
  orderId: string;
  orderNumber: number;
  issuedAt: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  establishmentName: string;
  establishmentAddress: string | null;
  establishmentPhone: string | null;
  logoUrl: string | null;
  currency: string;
  cashierName: string | null;
  tableReference: string | null;
  customerReference: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amountApplied: number;
    changeGiven: number;
  }>;
};

/** Addition client (provisoire) — imprimable sans encaissement. */
export type OrderAddition = {
  orderId: string;
  orderNumber: number;
  issuedAt: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentStatus: string;
  establishmentName: string;
  establishmentAddress: string | null;
  establishmentPhone: string | null;
  logoUrl: string | null;
  tableReference: string | null;
  customerReference: string | null;
  orderTypeLabel: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};
