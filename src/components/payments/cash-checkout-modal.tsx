"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Printer, ShoppingCart, X } from "lucide-react";

import { AlertMessage } from "@/components/auth/alert-message";
import { formatOrderNumber, formatPriceXof } from "@/lib/orders/constants";
import { calculateChange } from "@/lib/payments/constants";
import { buildReceiptHref } from "@/lib/payments/receipt-routes";

export type CashCheckoutSuccess = {
  receiptId?: string;
  changeGiven: number;
  totalPaid: number;
  orderNumber?: number;
};

type CashCheckoutModalProps = {
  totalToPay: number;
  orderNumber?: number;
  isPending?: boolean;
  error?: string | null;
  success?: CashCheckoutSuccess | null;
  retail?: boolean;
  onConfirm: (amountReceived: number) => void;
  onClose: () => void;
  onNewOrder: () => void;
};

export function CashCheckoutModal({
  totalToPay,
  orderNumber,
  isPending = false,
  error,
  success,
  retail = false,
  onConfirm,
  onClose,
  onNewOrder,
}: CashCheckoutModalProps) {
  const [amountReceived, setAmountReceived] = useState(String(totalToPay));

  const received = Number.parseInt(amountReceived, 10) || 0;
  const change = calculateChange(received, totalToPay);
  const canConfirm = !isPending && received >= totalToPay && totalToPay > 0;

  const subtitle = useMemo(() => {
    if (success) {
      return orderNumber || success.orderNumber
        ? `${retail ? "Ticket" : "Commande"} ${formatOrderNumber(orderNumber ?? success.orderNumber!)} payé${retail ? "" : "e"}`
        : "Paiement enregistré";
    }
    return "Espèces uniquement";
  }, [success, orderNumber, retail]);

  if (success) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cash-checkout-success-title"
          className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        >
          <div className="bg-gradient-to-b from-emerald-50 to-white px-5 py-7 text-center sm:px-6">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2
              id="cash-checkout-success-title"
              className="mt-3 text-lg font-bold text-slate-900"
            >
              Encaissement réussi
            </h2>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>

          <div className="space-y-4 px-5 pb-5 sm:px-6">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total encaissé</span>
                <span className="pos-tabular text-lg font-bold text-emerald-700">
                  {formatPriceXof(success.totalPaid)}
                </span>
              </div>
              {success.changeGiven > 0 ? (
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                  <span className="text-slate-600">Monnaie rendue</span>
                  <span className="pos-tabular font-bold text-slate-900">
                    {formatPriceXof(success.changeGiven)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              {success.receiptId ? (
                <Link
                  href={buildReceiptHref(success.receiptId, { print: true })}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer et nouvelle vente
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ShoppingCart className="h-4 w-4" />
                {success.receiptId
                  ? retail
                    ? "Nouvelle vente sans reçu"
                    : "Nouvelle commande sans reçu"
                  : retail
                    ? "Nouvelle vente"
                    : "Nouvelle commande"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={isPending ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-checkout-title"
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="cash-checkout-title" className="text-lg font-semibold text-slate-900">
              Encaissement
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Fermer"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 active:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          {error ? <AlertMessage message={error} /> : null}

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Total à payer</span>
            <span className="pos-tabular text-xl font-bold text-slate-900">
              {formatPriceXof(totalToPay)}
            </span>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Montant reçu</span>
            <input
              type="number"
              inputMode="numeric"
              min={totalToPay}
              step={1}
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
              disabled={isPending}
              autoFocus
              className="pos-tabular w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[16px] font-semibold text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4 disabled:opacity-60"
            />
          </label>

          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <span className="text-sm font-medium text-emerald-800">Monnaie à rendre</span>
            <span className="pos-tabular text-lg font-bold text-emerald-700">
              {formatPriceXof(change)}
            </span>
          </div>
        </div>

        <footer className="border-t border-slate-100 bg-slate-50/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(received)}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isPending ? "Encaissement…" : "Confirmer l'encaissement"}
          </button>
          {received > 0 && received < totalToPay ? (
            <p className="mt-2 text-center text-xs text-red-600">
              Le montant reçu doit couvrir le total.
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
