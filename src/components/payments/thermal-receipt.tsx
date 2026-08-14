"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import {
  formatPriceXof,
  formatReceiptNumber,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import { printThermalTicket } from "@/lib/payments/print-thermal-ticket";
import { formatOrderNumber } from "@/lib/orders/constants";
import { getActivityPages } from "@/lib/activity/pages";
import type { ReceiptDetail } from "@/lib/payments/types";

type ThermalReceiptProps = {
  receipt: ReceiptDetail;
  returnTo?: string | null;
  activityCode?: string | null;
};

/** Montant compact pour colonnes étroites (évite le chevauchement « F CFA »). */
function formatReceiptCell(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount)} F`;
}

export function ThermalReceipt({
  receipt,
  returnTo = null,
  activityCode = null,
}: ThermalReceiptProps) {
  const pages = getActivityPages(activityCode);
  const router = useRouter();
  const reference =
    receipt.tableReference ?? receipt.customerReference ?? "—";
  const homePath = returnTo || "/application/caisse?fresh=1";
  const redirectedRef = useRef(false);

  function returnHome() {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace(homePath);
  }

  function handleManualPrint() {
    window.addEventListener("afterprint", returnHome, { once: true });
    printThermalTicket();
  }

  return (
    <div className="thermal-receipt-host flex min-h-0 w-full flex-1 flex-col bg-slate-200">
      <div className="no-print shrink-0 border-b border-slate-300/80 bg-white px-3 py-3">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
          <h1 className="text-center text-[17px] font-bold text-slate-900">Reçu</h1>
          <button
            type="button"
            onClick={handleManualPrint}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-semibold text-white active:bg-emerald-700"
          >
            <Printer className="h-5 w-5" />
            Imprimer
          </button>
          <button
            type="button"
            onClick={returnHome}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-medium text-slate-600 active:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la caisse
          </button>
        </div>
      </div>
      <div
        className="thermal-receipt-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 py-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <article className="thermal-receipt w-[80mm] max-w-full shrink-0 rounded-sm bg-white p-3 text-black shadow-md ring-1 ring-slate-300">
          <header className="thermal-receipt-header text-center">
            {receipt.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- impression thermique
              <img
                src={receipt.logoUrl}
                alt=""
                className="receipt-logo mx-auto"
              />
            ) : (
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-700">
                FasoBar
              </p>
            )}
            <h1 className={`${receipt.logoUrl ? "mt-1.5" : "mt-2"} text-base font-bold`}>
              {receipt.establishmentName}
            </h1>
            {receipt.establishmentAddress ? (
              <p className="mt-1 text-xs">{receipt.establishmentAddress}</p>
            ) : null}
            {receipt.establishmentPhone ? (
              <p className="text-xs">Tél. {receipt.establishmentPhone}</p>
            ) : null}
          </header>

          <div className="my-3 border-t border-dashed border-black" />

          <section className="space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <span className="shrink-0">Reçu</span>
              <span className="min-w-0 text-right font-semibold">
                {formatReceiptNumber(receipt.receiptNumber)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0">Commande</span>
              <span className="min-w-0 text-right">
                {formatOrderNumber(receipt.orderNumber)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0">Date</span>
              <span className="min-w-0 text-right">
                {new Date(receipt.issuedAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0">{pages.tickets.cashierColumn}</span>
              <span className="min-w-0 break-words text-right">
                {receipt.cashierName ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0">{pages.tickets.clientColumn}</span>
              <span className="min-w-0 text-right">{reference}</span>
            </div>
          </section>

          <div className="my-3 border-t border-dashed border-black" />

          <section className="space-y-2 text-[11px]">
            <div className="flex border-b border-black pb-1 font-semibold">
              <span className="flex-1">Article</span>
              <span className="w-10 text-right">Qté</span>
              <span className="w-[4.5rem] text-right">P.U.</span>
              <span className="w-[4.5rem] text-right">Total</span>
            </div>
            {receipt.items.map((item, index) => (
              <div
                key={`${item.productName}-${index}`}
                className="border-b border-dashed border-slate-300 pb-1.5 last:border-0"
              >
                <p className="font-medium leading-snug">{item.productName}</p>
                <div className="mt-0.5 flex tabular-nums text-slate-800">
                  <span className="flex-1" />
                  <span className="w-10 text-right">{item.quantity}</span>
                  <span className="w-[4.5rem] text-right whitespace-nowrap">
                    {formatReceiptCell(item.unitPrice)}
                  </span>
                  <span className="w-[4.5rem] text-right font-medium whitespace-nowrap">
                    {formatReceiptCell(item.lineTotal)}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <div className="my-3 border-t border-dashed border-black" />

          <section className="space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <span>Sous-total</span>
              <span className="tabular-nums">{formatPriceXof(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Remise</span>
              <span className="tabular-nums">{formatPriceXof(receipt.discount)}</span>
            </div>
            <div className="flex justify-between gap-3 text-sm font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatPriceXof(receipt.total)}</span>
            </div>
          </section>

          <div className="my-3 border-t border-dashed border-black" />

          <section className="space-y-1 text-xs">
            <p className="font-semibold">Paiements</p>
            {receipt.payments.map((payment, index) => (
              <div
                key={`${payment.method}-${index}`}
                className="flex justify-between gap-3"
              >
                <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
                <span className="tabular-nums">
                  {formatPriceXof(payment.amountApplied)}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-3 pt-1 font-semibold">
              <span>Montant reçu</span>
              <span className="tabular-nums">{formatPriceXof(receipt.paid)}</span>
            </div>
            {receipt.change > 0 ? (
              <div className="flex justify-between gap-3">
                <span>Monnaie rendue</span>
                <span className="tabular-nums">
                  {formatPriceXof(receipt.change)}
                </span>
              </div>
            ) : null}
          </section>

          <div className="my-4 border-t border-dashed border-black" />

          <footer className="pb-2 text-center text-xs">
            <p className="font-medium">Merci pour votre visite !</p>
            <p className="mt-1 text-[10px] text-slate-600">
              À bientôt chez {receipt.establishmentName}
            </p>
          </footer>
        </article>
        <div className="no-print h-8 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
