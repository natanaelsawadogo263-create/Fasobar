"use client";

import Link from "next/link";
import { CheckCircle2, Printer, ShoppingCart } from "lucide-react";

import { formatPriceXof } from "@/lib/payments/constants";
import { formatOrderNumber } from "@/lib/orders/constants";

type PaymentSuccessScreenProps = {
  orderNumber: number;
  totalPaid: number;
  changeGiven: number;
  receiptId?: string;
};

export function PaymentSuccessScreen({
  orderNumber,
  totalPaid,
  changeGiven,
  receiptId,
}: PaymentSuccessScreenProps) {
  return (
    <div className="checkout-shell flex h-full flex-col items-center justify-center bg-[#eef0f3] p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-lg">
        <div className="bg-gradient-to-b from-emerald-50 to-white px-6 py-8 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Encaissement réussi</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Commande {formatOrderNumber(orderNumber)} entièrement payée
          </p>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total encaissé</span>
              <span className="pos-tabular text-xl font-bold text-emerald-700">
                {formatPriceXof(totalPaid)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Paiement</span>
              <span className="font-medium text-slate-900">Espèces</span>
            </div>
            {changeGiven > 0 ? (
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="text-slate-600">Monnaie rendue</span>
                <span className="pos-tabular font-bold text-slate-900">
                  {formatPriceXof(changeGiven)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            {receiptId ? (
              <Link
                href={`/application/recus/${receiptId}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Printer className="h-4 w-4" />
                Imprimer le reçu
              </Link>
            ) : null}
            <Link
              href="/application/caisse?fresh=1"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ShoppingCart className="h-4 w-4" />
              Nouvelle commande
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
