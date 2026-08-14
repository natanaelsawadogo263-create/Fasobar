import { HARDWARE_CREDIT_LIMIT_XOF } from "@/lib/hardware/constants";
import type { HardwareSaleMode } from "@/lib/hardware/constants";

export function resolveSaleUnitPrice(input: {
  saleMode: HardwareSaleMode;
  retailPrice: number;
  wholesalePrice: number | null | undefined;
}): number {
  if (input.saleMode === "WHOLESALE") {
    const wholesale = input.wholesalePrice;
    if (typeof wholesale === "number" && wholesale > 0) {
      return wholesale;
    }
  }
  return input.retailPrice;
}

export function applyQuantityDiscount(input: {
  unitPrice: number;
  quantity: number;
  minQuantity: number | null | undefined;
  percent: number | null | undefined;
}): { unitPrice: number; discountPercent: number } {
  const percent = input.percent;
  const minQty = input.minQuantity;
  if (
    typeof percent !== "number" ||
    percent <= 0 ||
    typeof minQty !== "number" ||
    minQty <= 0 ||
    input.quantity < minQty
  ) {
    return { unitPrice: input.unitPrice, discountPercent: 0 };
  }

  const capped = Math.min(percent, 100);
  const discounted = Math.round(input.unitPrice * (1 - capped / 100));
  return {
    unitPrice: Math.max(0, discounted),
    discountPercent: capped,
  };
}

export function remainingCustomerCredit(currentDebtXof: number): number {
  const debt = Number.isFinite(currentDebtXof) ? Math.max(0, currentDebtXof) : 0;
  return Math.max(0, HARDWARE_CREDIT_LIMIT_XOF - debt);
}

export function canGrantCustomerCredit(input: {
  currentDebtXof: number;
  additionalCreditXof: number;
}): boolean {
  if (input.additionalCreditXof <= 0) return true;
  return remainingCustomerCredit(input.currentDebtXof) >= input.additionalCreditXof;
}

export function cashCloseVariance(declaredXof: number, theoreticalXof: number): {
  variance: number;
  status: "balanced" | "surplus" | "shortage";
} {
  const variance = declaredXof - theoreticalXof;
  if (variance === 0) return { variance, status: "balanced" };
  if (variance > 0) return { variance, status: "surplus" };
  return { variance, status: "shortage" };
}
