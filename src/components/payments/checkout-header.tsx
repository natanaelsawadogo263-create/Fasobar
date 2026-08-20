"use client";

import { ArrowLeft, Receipt } from "lucide-react";

import { InstantLink } from "@/components/layout/instant-link";
import { formatOrderNumber } from "@/lib/orders/constants";

type CheckoutHeaderProps = {
  orderNumber: number;
  referenceLabel: string;
};

export function CheckoutHeader({ orderNumber, referenceLabel }: CheckoutHeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950 px-3 lg:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <InstantLink
          href="/application/caisse"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 text-slate-400 transition hover:bg-slate-800 hover:text-white sm:h-8 sm:w-8"
          aria-label="Retour à la caisse"
          title="Retour à la caisse"
        >
          <ArrowLeft className="h-4 w-4" />
        </InstantLink>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              Encaissement
            </span>
            <p className="truncate text-sm font-semibold text-white">
              {formatOrderNumber(orderNumber)}
            </p>
          </div>
          <p className="truncate text-[11px] text-slate-400">
            Réf. {referenceLabel}
          </p>
        </div>
      </div>

      <InstantLink
        href="/application/commandes-ouvertes"
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800 sm:h-8"
      >
        <Receipt className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Commandes</span>
      </InstantLink>
    </header>
  );
}
