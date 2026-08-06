"use client";

import { Plus, Trash2 } from "lucide-react";

import { PriceField, TextField } from "@/components/ui/form-controls";
import {
  formatPriceXof,
  MOBILE_MONEY_METHODS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import type { PaymentMethod } from "@/lib/payments/schemas";
import type { DraftPaymentLine } from "@/components/payments/checkout-payment-panel";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "ORANGE_MONEY",
  "MOOV_MONEY",
  "TELECEL_MONEY",
  "CARD",
  "OTHER",
];

type CheckoutPaymentCenterProps = {
  projectedRemaining: number;
  draftLines: DraftPaymentLine[];
  selectedMethod: PaymentMethod;
  amountReceived: string;
  transactionReference: string;
  currentChange: number;
  methodRequiresSession: boolean;
  onSelectMethod: (method: PaymentMethod) => void;
  onAmountReceivedChange: (value: string) => void;
  onTransactionReferenceChange: (value: string) => void;
  onPayFull: () => void;
  onAddLine: () => void;
  onRemoveLine: (id: string) => void;
};

export function CheckoutPaymentCenter({
  projectedRemaining,
  draftLines,
  selectedMethod,
  amountReceived,
  transactionReference,
  currentChange,
  methodRequiresSession,
  onSelectMethod,
  onAmountReceivedChange,
  onTransactionReferenceChange,
  onPayFull,
  onAddLine,
  onRemoveLine,
}: CheckoutPaymentCenterProps) {
  return (
    <section className="flex w-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white lg:w-[400px] xl:w-[420px]">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Montant à encaisser
          </p>
          <p className="pos-tabular text-2xl font-bold text-emerald-700">
            {formatPriceXof(projectedRemaining)}
          </p>
        </div>
        <button
          type="button"
          onClick={onPayFull}
          disabled={projectedRemaining <= 0}
          className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-40"
        >
          Payer le solde
        </button>
      </div>

      <div className="pos-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => onSelectMethod(method)}
              className={`rounded-xl border px-2 py-3 text-center transition ${
                selectedMethod === method
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30"
                  : "border-slate-200 hover:border-emerald-300"
              }`}
            >
              <span className="text-xl" aria-hidden="true">
                {PAYMENT_METHOD_ICONS[method]}
              </span>
              <p className="mt-1 text-[10px] font-semibold text-slate-800">
                {PAYMENT_METHOD_LABELS[method]}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-900">
            Paiement en {PAYMENT_METHOD_LABELS[selectedMethod].toLowerCase()}
          </p>
          <div className="space-y-3">
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
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="text-slate-600">Monnaie à rendre</span>
                  <span className="pos-tabular font-bold text-emerald-700">
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
              disabled={methodRequiresSession || projectedRemaining <= 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Ajouter un moyen de paiement
            </button>
          </div>
        </div>

        {draftLines.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Paiements mixtes
            </p>
            <ul className="space-y-2">
              {draftLines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{PAYMENT_METHOD_LABELS[line.method]}</p>
                    <p className="pos-tabular text-xs text-slate-500">
                      {formatPriceXof(line.amountApplied)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Retirer"
                    onClick={() => onRemoveLine(line.id)}
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">
        <p>Après confirmation, le reçu sera imprimé automatiquement.</p>
        <p className="mt-1 font-medium text-emerald-700">Paiement 100% sécurisé</p>
      </footer>
    </section>
  );
}
