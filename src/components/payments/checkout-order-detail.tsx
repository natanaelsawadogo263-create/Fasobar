"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";

import { formatPriceXof } from "@/lib/payments/constants";
import type { OrderPaymentSummary } from "@/lib/payments/types";

type CheckoutOrderDetailProps = {
  summary: OrderPaymentSummary;
  projectedRemaining: number;
};

function formatCmdNumber(orderNumber: number): string {
  return `N° CMD-2024-${String(orderNumber).padStart(6, "0")}`;
}

export function CheckoutOrderDetail({ summary, projectedRemaining }: CheckoutOrderDetailProps) {
  const reference = summary.tableReference ?? summary.customerReference ?? "—";
  const createdLabel = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="shrink-0 border-b border-slate-200 px-5 py-4">
        <Link
          href="/application/caisse"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Encaissement
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-700">{formatCmdNumber(summary.orderNumber)}</p>
            <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              Prête à encaisser
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {reference}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {createdLabel}
          </span>
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Articles commandés ({summary.items.length} articles)
        </p>
      </div>

      <div className="pos-scroll min-h-0 flex-1 overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Article</th>
              <th className="px-3 py-2.5 font-medium">Qté</th>
              <th className="px-3 py-2.5 font-medium">Prix unitaire</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summary.items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3 font-medium uppercase text-slate-900">
                  {item.productName}
                </td>
                <td className="px-3 py-3 text-slate-600">{item.quantity}</td>
                <td className="pos-tabular px-3 py-3 text-slate-600">
                  {formatPriceXof(item.unitPrice)}
                </td>
                <td className="pos-tabular px-5 py-3 text-right font-semibold text-slate-900">
                  {formatPriceXof(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Sous-total</dt>
            <dd className="pos-tabular">{formatPriceXof(summary.subtotal)}</dd>
          </div>
          {summary.discountAmount > 0 ? (
            <div className="flex justify-between text-red-600">
              <dt>Remise / Réduction</dt>
              <dd className="pos-tabular">−{formatPriceXof(summary.discountAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-800">Total à payer</dt>
            <dd className="pos-tabular text-lg font-bold text-emerald-700">
              {formatPriceXof(summary.totalAmount)}
            </dd>
          </div>
          {summary.paidAmount > 0 ? (
            <div className="flex justify-between text-slate-600">
              <dt>Déjà payé</dt>
              <dd className="pos-tabular font-medium">{formatPriceXof(summary.paidAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="font-semibold text-slate-800">Reste à payer</dt>
            <dd className="pos-tabular text-xl font-bold text-emerald-700">
              {formatPriceXof(projectedRemaining)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
