"use client";

import { ShoppingBag } from "lucide-react";

export function EmptyOrderState() {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div className="w-full max-w-[240px] rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <ShoppingBag className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">Panier vide</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Sélectionnez un produit dans la grille pour commencer la commande.
        </p>
      </div>
    </div>
  );
}
