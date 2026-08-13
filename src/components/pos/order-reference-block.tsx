"use client";

import { ShoppingBag, Store } from "lucide-react";

import { ORDER_TYPE_LABELS } from "@/lib/orders/constants";
import type { OrderType } from "@/lib/orders/schemas";

type OrderReferenceBlockProps = {
  tableReference: string;
  orderType: OrderType;
  onTableChange: (value: string) => void;
  onOrderTypeChange: (type: OrderType) => void;
  /** Version plus courte pour le panneau caisse. */
  compact?: boolean;
  retailMode?: boolean;
  clientPlaceholder?: string;
};

export function OrderReferenceBlock({
  tableReference,
  orderType,
  onTableChange,
  onOrderTypeChange,
  compact = false,
  retailMode = false,
  clientPlaceholder,
}: OrderReferenceBlockProps) {
  const placeholder = clientPlaceholder ?? (retailMode ? "Nom du client (optionnel)" : "Table / réf. (ex. T12)");

  if (retailMode) {
    return (
      <div className={`shrink-0 border-b border-[#eeeeee] ${compact ? "px-3.5 py-2.5" : "px-5 py-4"}`}>
        <div className="relative">
          <label htmlFor="pos-client-ref" className="sr-only">
            Client
          </label>
          <Store
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#059669]"
            strokeWidth={2}
          />
          <input
            id="pos-client-ref"
            type="text"
            value={tableReference}
            onChange={(event) => onTableChange(event.target.value)}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white py-2 pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15"
          />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="shrink-0 space-y-2 border-b border-[#eeeeee] px-3.5 py-2.5">
        <div className="relative">
          <label htmlFor="pos-table-ref" className="sr-only">
            Table / Référence
          </label>
          <Store
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#059669]"
            strokeWidth={2}
          />
          <input
            id="pos-table-ref"
            type="text"
            value={tableReference}
            onChange={(event) => onTableChange(event.target.value)}
            placeholder="Table / réf. (ex. T12)"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white py-2 pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15"
          />
        </div>

        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-[#f3f4f6] p-1"
          role="group"
          aria-label="Type de commande"
        >
          <button
            type="button"
            aria-pressed={orderType === "ON_SITE"}
            onClick={() => onOrderTypeChange("ON_SITE")}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[12px] font-semibold transition ${
              orderType === "ON_SITE"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#6b7280] hover:text-[#111827]"
            }`}
          >
            <Store className="h-3.5 w-3.5" strokeWidth={2} />
            {ORDER_TYPE_LABELS.ON_SITE}
          </button>
          <button
            type="button"
            aria-pressed={orderType === "TAKEAWAY"}
            onClick={() => onOrderTypeChange("TAKEAWAY")}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[12px] font-semibold transition ${
              orderType === "TAKEAWAY"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#6b7280] hover:text-[#111827]"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
            {ORDER_TYPE_LABELS.TAKEAWAY}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-4 px-5 py-4">
      <div>
        <label htmlFor="pos-table-ref" className="mb-2 block text-[12px] font-medium text-[#6b7280]">
          Table / Référence
        </label>
        <div className="relative">
          <Store
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#059669]"
            strokeWidth={2}
          />
          <input
            id="pos-table-ref"
            type="text"
            value={tableReference}
            onChange={(event) => onTableChange(event.target.value)}
            placeholder="Ex. T12, Terrasse 3"
            className="h-11 w-full rounded-xl border border-[#e5e7eb] bg-white py-2.5 pl-11 pr-3 text-[13px] font-medium text-[#111827] outline-none placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-medium text-[#6b7280]">Type de commande</p>
        <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Type de commande">
          <button
            type="button"
            aria-pressed={orderType === "ON_SITE"}
            onClick={() => onOrderTypeChange("ON_SITE")}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition ${
              orderType === "ON_SITE"
                ? "bg-[#059669] text-white"
                : "border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
            }`}
          >
            <Store className="h-4 w-4" strokeWidth={2} />
            {ORDER_TYPE_LABELS.ON_SITE}
          </button>
          <button
            type="button"
            aria-pressed={orderType === "TAKEAWAY"}
            onClick={() => onOrderTypeChange("TAKEAWAY")}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition ${
              orderType === "TAKEAWAY"
                ? "bg-[#059669] text-white"
                : "border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
            }`}
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={2} />
            {ORDER_TYPE_LABELS.TAKEAWAY}
          </button>
        </div>
      </div>
    </div>
  );
}
