"use client";

import { useEffect, useState, useTransition } from "react";

import { fetchStockMovementsAction } from "@/app/(protected)/application/stock/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import {
  formatPriceXof,
  formatQuantity,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/stock/constants";
import type { StockListItem, StockMovementItem } from "@/lib/stock/types";

type StockHistoryModalProps = {
  stockItem: StockListItem;
  onClose: () => void;
};

export function StockHistoryModal({ stockItem, onClose }: StockHistoryModalProps) {
  const [isPending, startTransition] = useTransition();
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchStockMovementsAction(stockItem.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMovements(result.movements);
    });
  }, [stockItem.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-history-title"
        className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 id="stock-history-title" className="text-lg font-semibold text-slate-900">
              Historique — {stockItem.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Derniers mouvements enregistrés pour cet article.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Fermer
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <AlertMessage message={error} />
          ) : isPending ? (
            <p className="text-sm text-slate-500">Chargement de l&apos;historique...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun mouvement enregistré.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Qté</th>
                    <th className="px-3 py-2 font-medium">Avant / Après</th>
                    <th className="px-3 py-2 font-medium">Coût</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-3 py-3 text-slate-700">
                        {new Date(movement.createdAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-3 py-3">
                        {MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {movement.quantity > 0 ? "+" : ""}
                        {formatQuantity(movement.quantity, stockItem.unit)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {movement.quantityBefore} → {movement.quantityAfter}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {movement.totalCost !== null
                          ? formatPriceXof(movement.totalCost)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
