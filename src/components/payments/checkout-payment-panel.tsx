"use client";

import { Plus, Trash2 } from "lucide-react";

import { PriceField, TextField } from "@/components/ui/form-controls";
import {
  calculateChange,
  formatPriceXof,
  MOBILE_MONEY_METHODS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import type { PaymentMethod } from "@/lib/payments/schemas";
import type { OrderPaymentSummary } from "@/lib/payments/types";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "ORANGE_MONEY",
  "MOOV_MONEY",
  "TELECEL_MONEY",
  "CARD",
  "OTHER",
];

export type DraftPaymentLine = {
  id: string;
  method: PaymentMethod;
  amountApplied: number;
  amountReceived: number;
  transactionReference: string;
};

type CheckoutPaymentPanelProps = {
  summary: OrderPaymentSummary;
  projectedRemaining: number;
  draftLines: DraftPaymentLine[];
  selectedMethod: PaymentMethod;
  amountReceived: string;
  transactionReference: string;
  currentChange: number;
  methodRequiresSession: boolean;
  isPending: boolean;
  onSelectMethod: (method: PaymentMethod) => void;
  onAmountReceivedChange: (value: string) => void;
  onTransactionReferenceChange: (value: string) => void;
  onPayFull: () => void;
  onAddLine: () => void;
  onRemoveLine: (id: string) => void;
  onConfirmCheckout: () => void;
};

export function CheckoutPaymentPanel({
  summary,
  projectedRemaining,
  draftLines,
  selectedMethod,
  amountReceived,
  transactionReference,
  currentChange,
  methodRequiresSession,
  isPending,
  onSelectMethod,
  onAmountReceivedChange,
  onTransactionReferenceChange,
  onPayFull,
  onAddLine,
  onRemoveLine,
  onConfirmCheckout,
}: CheckoutPaymentPanelProps) {
  const canConfirm = draftLines.length > 0 && !isPending;

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white lg:w-[380px] xl:w-[400px]">
      {/* Montants */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Sous-total</span>
            <span className="pos-tabular font-medium">{formatPriceXof(summary.subtotal)}</span>
          </div>
          {summary.discountAmount > 0 ? (
            <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
              <span>Remise</span>
              <span className="pos-tabular font-medium text-red-600">
                −{formatPriceXof(summary.discountAmount)}
              </span>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="pos-tabular text-lg font-bold text-slate-900">
              {formatPriceXof(summary.totalAmount)}
            </span>
          </div>
          {summary.paidAmount > 0 ? (
            <div className="mt-1 flex items-center justify-between text-xs text-emerald-700">
              <span>Déjà payé</span>
              <span className="pos-tabular font-semibold">
                {formatPriceXof(summary.paidAmount)}
              </span>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-2">
            <span className="text-xs font-semibold text-amber-900">Reste à payer</span>
            <span className="pos-tabular text-xl font-bold text-amber-800">
              {formatPriceXof(projectedRemaining)}
            </span>
          </div>
        </div>
      </div>

      {/* Corps scrollable — formulaire + brouillon */}
      <div className="pos-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Mode de paiement</h2>
          <button
            type="button"
            onClick={onPayFull}
            disabled={projectedRemaining <= 0}
            className="text-[11px] font-semibold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Payer le solde
          </button>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => onSelectMethod(method)}
              className={`rounded-lg border px-2 py-2 text-left transition active:scale-[0.98] ${
                selectedMethod === method
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30"
                  : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {PAYMENT_METHOD_ICONS[method]}
              </span>
              <p className="mt-1 truncate text-[10px] font-semibold text-slate-800">
                {PAYMENT_METHOD_LABELS[method]}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <span className="text-sm text-slate-600">Montant de la commande</span>
            <span className="pos-tabular text-sm font-bold text-slate-900">
              {formatPriceXof(projectedRemaining)}
            </span>
          </div>

          {selectedMethod === "CASH" ? (
            <>
              <PriceField
                id="amountReceived"
                label="Montant reçu"
                value={amountReceived}
                onChange={(event) => onAmountReceivedChange(event.target.value)}
              />
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-600">Monnaie à rendre</span>
                <span className="pos-tabular font-bold text-slate-900">
                  {formatPriceXof(currentChange)}
                </span>
              </div>
            </>
          ) : null}

          {MOBILE_MONEY_METHODS.has(selectedMethod) || selectedMethod === "OTHER" ? (
            <TextField
              id="transactionReference"
              label="Référence (facultatif)"
              value={transactionReference}
              onChange={(event) => onTransactionReferenceChange(event.target.value)}
              placeholder="Numéro de transaction"
            />
          ) : null}

          <button
            type="button"
            onClick={onAddLine}
            disabled={methodRequiresSession}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Ajouter au récapitulatif
          </button>
        </div>

        {draftLines.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900">
              Récapitulatif ({draftLines.length})
            </p>
            <ul className="mt-2 space-y-1.5">
              {draftLines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">
                      {PAYMENT_METHOD_LABELS[line.method]}
                    </p>
                    {line.method === "CASH" ? (
                      <p className="text-[10px] text-slate-500">
                        Reçu {formatPriceXof(line.amountReceived)} · Monnaie{" "}
                        {formatPriceXof(
                          calculateChange(line.amountReceived, line.amountApplied),
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="pos-tabular text-sm font-bold text-slate-900">
                      {formatPriceXof(line.amountApplied)}
                    </span>
                    <button
                      type="button"
                      aria-label="Retirer la ligne"
                      onClick={() => onRemoveLine(line.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-center text-[11px] text-slate-400">
            Ajoutez au moins un paiement pour confirmer l&apos;encaissement
          </p>
        )}
      </div>

      {/* Pied fixe — confirmation */}
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirmCheckout}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md transition hover:bg-emerald-500 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          {isPending ? "Encaissement…" : "Confirmer l'encaissement"}
        </button>
      </footer>
    </aside>
  );
}
