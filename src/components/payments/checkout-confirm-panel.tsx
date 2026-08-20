"use client";

import { InstantLink } from "@/components/layout/instant-link";

import {
  calculateChange,
  formatPriceXof,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import type { OrderPaymentSummary } from "@/lib/payments/types";
import type { DraftPaymentLine } from "@/components/payments/checkout-payment-panel";

function formatCmdNumber(orderNumber: number): string {
  return `N° CMD-2024-${String(orderNumber).padStart(6, "0")}`;
}

type CheckoutConfirmPanelProps = {
  summary: OrderPaymentSummary;
  projectedRemaining: number;
  draftLines: DraftPaymentLine[];
  draftTotal: number;
  isPending: boolean;
  canConfirm: boolean;
  onConfirm: () => void;
};

export function CheckoutConfirmPanel({
  summary,
  projectedRemaining,
  draftLines,
  draftTotal,
  isPending,
  canConfirm,
  onConfirm,
}: CheckoutConfirmPanelProps) {
  const reference = summary.tableReference ?? summary.customerReference ?? "—";
  const totalChange = draftLines
    .filter((line) => line.method === "CASH")
    .reduce(
      (sum, line) => sum + calculateChange(line.amountReceived, line.amountApplied),
      0,
    );

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden bg-[#f8fafc] lg:w-[320px] xl:w-[340px]">
      <div className="pos-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <span className="text-xl">✓</span>
          </div>
          <h2 className="mt-3 text-base font-bold text-slate-900">Prêt à encaisser</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Vérifiez les informations et confirmez l&apos;encaissement de cette commande.
          </p>
        </div>

        <dl className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">N° Commande</dt>
            <dd className="font-medium text-slate-900">{formatCmdNumber(summary.orderNumber)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Table / Référence</dt>
            <dd className="font-medium text-slate-900">{reference}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Total à payer</dt>
            <dd className="pos-tabular font-medium">{formatPriceXof(summary.totalAmount)}</dd>
          </div>
          {summary.paidAmount > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Déjà payé</dt>
              <dd className="pos-tabular font-medium text-emerald-700">
                {formatPriceXof(summary.paidAmount)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
            <dt className="font-semibold text-slate-800">Reste à encaisser</dt>
            <dd className="pos-tabular text-lg font-bold text-emerald-700">
              {formatPriceXof(projectedRemaining)}
            </dd>
          </div>
        </dl>

        {draftLines.length > 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Détail des paiements
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {draftLines.map((line) => (
                <li key={line.id} className="flex justify-between">
                  <span>{PAYMENT_METHOD_LABELS[line.method]}</span>
                  <span className="pos-tabular font-medium">
                    {formatPriceXof(line.amountApplied)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm">
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>Total encaissé</span>
                <span className="pos-tabular">{formatPriceXof(draftTotal)}</span>
              </div>
              {totalChange > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>Monnaie à rendre</span>
                  <span className="pos-tabular font-medium text-emerald-700">
                    {formatPriceXof(totalChange)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-4">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isPending ? "Encaissement…" : "Confirmer l'encaissement"}
        </button>
        <InstantLink
          href="/application/caisse"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </InstantLink>
      </footer>
    </aside>
  );
}
