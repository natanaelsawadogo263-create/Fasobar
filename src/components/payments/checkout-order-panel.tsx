"use client";

import {
  formatPriceXof,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import type { OrderPaymentSummary } from "@/lib/payments/types";

type CheckoutOrderPanelProps = {
  items: OrderPaymentSummary["items"];
  confirmedPayments: OrderPaymentSummary["payments"];
};

export function CheckoutOrderPanel({
  items,
  confirmedPayments,
}: CheckoutOrderPanelProps) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f4f5f7] lg:max-w-none">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">Détail commande</h2>
        <p className="text-[11px] text-slate-500">
          {itemCount} article{itemCount > 1 ? "s" : ""} · {items.length} ligne
          {items.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="pos-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{item.productName}</p>
                <p className="pos-tabular mt-0.5 text-xs text-slate-500">
                  {item.quantity} × {formatPriceXof(item.unitPrice)}
                </p>
              </div>
              <p className="pos-tabular shrink-0 text-sm font-bold text-slate-900">
                {formatPriceXof(item.lineTotal)}
              </p>
            </li>
          ))}
        </ul>

        {confirmedPayments.length > 0 ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
              Déjà encaissé
            </p>
            <ul className="mt-2 space-y-1.5">
              {confirmedPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between rounded-md bg-white px-2.5 py-2 text-xs"
                >
                  <span className="font-medium text-slate-700">
                    {PAYMENT_METHOD_LABELS[payment.method]}
                  </span>
                  <span className="pos-tabular font-semibold text-emerald-700">
                    {formatPriceXof(payment.amountApplied)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
