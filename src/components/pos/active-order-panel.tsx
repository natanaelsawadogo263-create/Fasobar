"use client";

import { BriefcaseBusiness, Clock, Plus, Trash2 } from "lucide-react";

import { OrderItemRow } from "@/components/pos/order-item-row";
import { OrderReferenceBlock } from "@/components/pos/order-reference-block";
import { formatPriceXof } from "@/lib/orders/constants";
import type { CartLine } from "@/lib/orders/types";
import type { OrderType } from "@/lib/orders/schemas";

type ActiveOrderPanelProps = {
  tableReference: string;
  orderType: OrderType;
  cart: CartLine[];
  subtotal: number;
  discountAmount: number;
  isPending: boolean;
  onTableChange: (value: string) => void;
  onOrderTypeChange: (type: OrderType) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onNotesChange: (productId: string, notes: string) => void;
  onRemove: (productId: string) => void;
  onHold: () => void;
  onCheckout: () => void;
  onClear: () => void;
  onNewOrder?: () => void;
  className?: string;
};

export function ActiveOrderPanel({
  tableReference,
  orderType,
  cart,
  subtotal,
  discountAmount,
  isPending,
  onTableChange,
  onOrderTypeChange,
  onQuantityChange,
  onNotesChange,
  onRemove,
  onHold,
  onCheckout,
  onClear,
  onNewOrder,
  className = "",
}: ActiveOrderPanelProps) {
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const isEmpty = cart.length === 0;
  const total = Math.max(subtotal - discountAmount, 0);

  return (
    <aside
      className={`flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden border-l border-[#e5e7eb] bg-white ${className}`}
    >
      {/* 1. Titre */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eeeeee] px-4 py-2.5">
        <div>
          <h2 className="text-[15px] font-bold leading-none text-[#111827]">Commande active</h2>
          <p className="mt-1 text-[11px] text-[#9ca3af]">
            {isEmpty ? "Panier vide" : `${itemCount} article${itemCount > 1 ? "s" : ""}`}
          </p>
        </div>
        {onNewOrder ? (
          <button
            type="button"
            onClick={onNewOrder}
            disabled={isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#111827] px-2.5 text-[12px] font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Nouvelle
          </button>
        ) : null}
      </header>

      {/* 2. Table + type */}
      <OrderReferenceBlock
        tableReference={tableReference}
        orderType={orderType}
        onTableChange={onTableChange}
        onOrderTypeChange={onOrderTypeChange}
        compact
      />

      {/* 3. Total + actions — toujours visibles (au-dessus du panier) */}
      <div className="shrink-0 border-b border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-[#111827]">Total à payer</p>
            <p className="text-[10px] text-[#9ca3af]">
              {itemCount} article{itemCount > 1 ? "s" : ""}
            </p>
          </div>
          <p className="pos-tabular text-[22px] font-bold leading-none text-[#059669]">
            {formatPriceXof(isEmpty ? 0 : total)}
          </p>
        </div>

        {!isEmpty && discountAmount > 0 ? (
          <div className="mb-2 flex items-center justify-between text-[11px] text-[#6b7280]">
            <span>Remise</span>
            <span className="pos-tabular font-medium text-[#ef4444]">
              −{formatPriceXof(discountAmount)}
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isPending || isEmpty}
            onClick={onHold}
            title="Enregistrer la commande et ouvrir une nouvelle"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-2 text-[12px] font-semibold text-[#92400e] transition hover:bg-[#fef3c7] disabled:cursor-not-allowed disabled:border-[#e5e7eb] disabled:bg-white disabled:text-[#9ca3af]"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Mettre en attente
          </button>

          <button
            type="button"
            disabled={isPending || isEmpty}
            onClick={onCheckout}
            title="Encaisser maintenant (F8)"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-2 text-[13px] font-bold text-white transition hover:bg-[#047857] disabled:cursor-not-allowed disabled:bg-[#e5e7eb] disabled:text-[#9ca3af]"
          >
            <BriefcaseBusiness className="h-4 w-4 shrink-0" strokeWidth={2} />
            {isPending ? "…" : "Encaisser"}
          </button>
        </div>
      </div>

      {/* 4. Articles — scroll + snap article par article */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <p className="text-[13px] font-semibold text-[#374151]">
            Articles
            {!isEmpty ? (
              <span className="ml-1.5 font-normal text-[#9ca3af]">
                ({cart.length})
              </span>
            ) : null}
          </p>
          {!isEmpty ? (
            <button
              type="button"
              onClick={onClear}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ef4444] transition hover:text-[#dc2626] disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" strokeWidth={2} />
              Vider
            </button>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t border-[#f3f4f6]">
          {isEmpty ? (
            <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center px-6 text-center">
              <p className="text-[13px] font-medium text-[#6b7280]">Aucun article</p>
              <p className="mt-1 max-w-[220px] text-[12px] leading-relaxed text-[#9ca3af]">
                Cliquez un produit à gauche pour l&apos;ajouter ici.
              </p>
            </div>
          ) : (
            <ul
              className="cart-snap-list h-[148px] overflow-y-auto overscroll-y-contain"
              style={{
                scrollSnapType: "y mandatory",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {cart.map((line) => (
                <OrderItemRow
                  key={line.productId}
                  line={line}
                  onQuantityChange={onQuantityChange}
                  onNotesChange={onNotesChange}
                  onRemove={onRemove}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </aside>
  );
}

export function formatPosOrderLabel(orderNumber?: number): string {
  if (orderNumber) {
    return `#${String(orderNumber).padStart(4, "0")}`;
  }
  return "Nouvelle commande";
}
