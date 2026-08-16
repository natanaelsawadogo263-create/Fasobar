"use client";

import { useState } from "react";
import { Minus, Plus, StickyNote, X } from "lucide-react";

import { formatPriceXof } from "@/lib/orders/constants";
import type { CartLine } from "@/lib/orders/types";

type OrderItemRowProps = {
  line: CartLine;
  onQuantityChange: (productId: string, quantity: number, saleUnitId?: string) => void;
  onNotesChange: (productId: string, notes: string, saleUnitId?: string) => void;
  onRemove: (productId: string, saleUnitId?: string) => void;
};

export function OrderItemRow({
  line,
  onQuantityChange,
  onNotesChange,
  onRemove,
}: OrderItemRowProps) {
  const lineTotal = line.unitPrice * line.quantity;
  const hasNote = Boolean(line.notes?.trim());
  const [showNote, setShowNote] = useState(hasNote);

  return (
    <li className="border-b border-[#eeeeee] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-[#111827]">
            {line.name}
          </p>
          <p className="pos-tabular mt-0.5 text-[12px] text-[#6b7280]">
            {formatPriceXof(line.unitPrice)}
            {line.saleUnitId && line.unit ? ` · ${line.unit}` : ""}
          </p>
        </div>

        <div className="inline-flex h-11 shrink-0 items-center overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
          <button
            type="button"
            aria-label={`Diminuer ${line.name}`}
            onClick={() =>
              onQuantityChange(
                line.productId,
                Math.max(line.allowDecimal ? 0.1 : 0, Number((line.quantity - (line.allowDecimal ? 0.1 : 1)).toFixed(1))),
                line.saleUnitId,
              )
            }
            className="inline-flex h-full w-11 items-center justify-center text-[#4b5563] active:bg-white"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          {line.allowDecimal ? (
            <input
              type="number"
              min={0.001}
              step="0.1"
              inputMode="decimal"
              aria-label={`Quantité ${line.name}`}
              value={line.quantity}
              onWheel={(event) => event.currentTarget.blur()}
              onChange={(event) =>
                onQuantityChange(
                  line.productId,
                  Number(event.target.value) || 0,
                  line.saleUnitId,
                )
              }
              className="pos-tabular input-no-spinner h-8 w-14 bg-transparent text-center text-[13px] font-bold text-[#111827] outline-none"
            />
          ) : (
            <span className="pos-tabular inline-flex min-w-[1.5rem] items-center justify-center text-[13px] font-bold text-[#111827]">
              {line.quantity}
            </span>
          )}
          <button
            type="button"
            aria-label={`Augmenter ${line.name}`}
            onClick={() =>
              onQuantityChange(
                line.productId,
                Number((line.quantity + (line.allowDecimal ? 0.1 : 1)).toFixed(1)),
                line.saleUnitId,
              )
            }
            className="inline-flex h-full w-11 items-center justify-center text-[#4b5563] active:bg-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>

        <p className="pos-tabular w-[4.5rem] shrink-0 text-right text-[13px] font-semibold text-[#111827]">
          {formatPriceXof(lineTotal)}
        </p>

        <button
          type="button"
          aria-label={hasNote ? `Modifier la note de ${line.name}` : `Ajouter une note à ${line.name}`}
          aria-pressed={showNote}
          onClick={() => setShowNote((open) => !open)}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition ${
            hasNote || showNote
              ? "bg-amber-50 text-amber-700"
              : "text-[#9ca3af] active:bg-[#f3f4f6] active:text-[#6b7280]"
          }`}
        >
          <StickyNote className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <button
          type="button"
          aria-label={`Supprimer ${line.name}`}
          onClick={() => onRemove(line.productId, line.saleUnitId)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#9ca3af] active:bg-red-50 active:text-[#ef4444]"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {showNote ? (
        <div className="mt-2">
          <label htmlFor={`note-${line.productId}-${line.saleUnitId ?? "base"}`} className="sr-only">
            Note pour {line.name}
          </label>
          <input
            id={`note-${line.productId}-${line.saleUnitId ?? "base"}`}
            type="text"
            value={line.notes ?? ""}
            onChange={(event) =>
              onNotesChange(line.productId, event.target.value, line.saleUnitId)
            }
            placeholder="Note (optionnel)"
            className="h-8 w-full rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[12px] text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15"
          />
        </div>
      ) : hasNote ? (
        <p className="mt-1.5 truncate text-[11px] text-amber-800">
          Note : {line.notes}
        </p>
      ) : null}
    </li>
  );
}
