"use client";

import { formatPriceXof } from "@/lib/orders/constants";

type OrderSummaryProps = {
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  isEmpty?: boolean;
};

export function OrderSummary({
  itemCount,
  subtotal,
  discountAmount,
  isEmpty = false,
}: OrderSummaryProps) {
  const total = Math.max(subtotal - discountAmount, 0);

  return (
    <div className="space-y-1 px-4 pt-2 pb-1.5">
      {!isEmpty && discountAmount > 0 ? (
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-[#6b7280]">
            Sous-total · {itemCount} article{itemCount > 1 ? "s" : ""}
          </span>
          <span className="pos-tabular font-medium text-[#111827]">
            {formatPriceXof(subtotal)}
          </span>
        </div>
      ) : null}

      {!isEmpty && discountAmount > 0 ? (
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-[#6b7280]">Remise</span>
          <span className="pos-tabular font-medium text-[#ef4444]">
            −{formatPriceXof(discountAmount)}
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-[#111827]">Total à payer</p>
          <p className="text-[10px] text-[#9ca3af]">
            {itemCount} article{itemCount > 1 ? "s" : ""}
          </p>
        </div>
        <p className="pos-tabular text-[20px] font-bold leading-none text-[#059669]">
          {formatPriceXof(isEmpty ? 0 : total)}
        </p>
      </div>
    </div>
  );
}
