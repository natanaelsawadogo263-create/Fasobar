"use client";

import { useState } from "react";
import { Minus, Plus, StickyNote, X } from "lucide-react";

import { formatPriceXof } from "@/lib/orders/constants";
import type { CartLine } from "@/lib/orders/types";

type OrderItemRowProps = {
  line: CartLine;
  onQuantityChange: (productId: string, quantity: number) => void;
  onNotesChange: (productId: string, notes: string) => void;
  onRemove: (productId: string) => void;
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
    <li
      className="border-b border-[#eeeeee] px-4 py-3"
      style={{
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        minHeight: 64,
      }}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-[#111827]">
            {line.name}
          </p>
          <p className="pos-tabular mt-0.5 text-[12px] text-[#6b7280]">
            {formatPriceXof(line.unitPrice)}
          </p>
        </div>

        <div className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
          <button
            type="button"
            aria-label={`Diminuer ${line.name}`}
            onClick={() => onQuantityChange(line.productId, line.quantity - 1)}
            className="inline-flex h-full w-7 items-center justify-center text-[#4b5563] hover:bg-white"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <span className="pos-tabular inline-flex min-w-[1.5rem] items-center justify-center text-[13px] font-bold text-[#111827]">
            {line.quantity}
          </span>
          <button
            type="button"
            aria-label={`Augmenter ${line.name}`}
            onClick={() => onQuantityChange(line.productId, line.quantity + 1)}
            className="inline-flex h-full w-7 items-center justify-center text-[#4b5563] hover:bg-white"
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
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
            hasNote || showNote
              ? "bg-amber-50 text-amber-700"
              : "text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"
          }`}
        >
          <StickyNote className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <button
          type="button"
          aria-label={`Supprimer ${line.name}`}
          onClick={() => onRemove(line.productId)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9ca3af] hover:bg-red-50 hover:text-[#ef4444]"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {showNote ? (
        <div className="mt-2">
          <label htmlFor={`note-${line.productId}`} className="sr-only">
            Note pour {line.name}
          </label>
          <input
            id={`note-${line.productId}`}
            type="text"
            value={line.notes ?? ""}
            onChange={(event) => onNotesChange(line.productId, event.target.value)}
            placeholder="Note (ex. sans glace, bien froid…)"
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
