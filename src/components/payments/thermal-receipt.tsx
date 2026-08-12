"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

import {
  formatPriceXof,
  formatReceiptNumber,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import { formatOrderNumber } from "@/lib/orders/constants";
import type { ReceiptDetail } from "@/lib/payments/types";

type ThermalReceiptProps = {
  receipt: ReceiptDetail;
  autoPrint?: boolean;
  /** Après fermeture de la boîte d'impression, naviguer ici (ex. /application/caisse?fresh=1). */
  returnTo?: string | null;
};

const printedReceiptIds = new Set<string>();

/** Montant compact pour colonnes étroites (évite le chevauchement « F CFA »). */
function formatReceiptCell(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount)} F`;
}

export function ThermalReceipt({
  receipt,
  autoPrint = false,
  returnTo = null,
}: ThermalReceiptProps) {
  const router = useRouter();
  const reference =
    receipt.tableReference ?? receipt.customerReference ?? "—";
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!autoPrint) {
      return;
    }

    function goToCaisse() {
      if (redirectedRef.current || !returnTo) {
        return;
      }
      redirectedRef.current = true;
      router.replace(returnTo);
    }

    function handleAfterPrint() {
      goToCaisse();
    }

    window.addEventListener("afterprint", handleAfterPrint);

    const mediaQuery = window.matchMedia("print");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        goToCaisse();
      }
    };
    mediaQuery.addEventListener?.("change", handleMediaChange);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      if (printedReceiptIds.has(receipt.id)) {
        goToCaisse();
        return;
      }
      printedReceiptIds.add(receipt.id);
      window.print();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
      mediaQuery.removeEventListener?.("change", handleMediaChange);
    };
  }, [autoPrint, receipt.id, returnTo, router]);

  function handleManualPrint() {
    if (printedReceiptIds.has(receipt.id)) {
      return;
    }
    printedReceiptIds.add(receipt.id);
    window.addEventListener(
      "afterprint",
      () => {
        if (returnTo) {
          router.replace(returnTo);
        }
      },
      { once: true },
    );
    window.print();
  }

  return (
    <div className="thermal-receipt-host relative min-h-0 w-full flex-1 basis-0">
      <div
        className="thermal-receipt-scroll absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto flex w-full max-w-[320px] flex-col items-center px-3 py-4 pb-12">
          {!autoPrint ? (
            <div className="no-print sticky top-0 z-10 mb-3 flex w-full justify-center bg-[#f4f6f9] py-2">
              <button
                type="button"
                onClick={handleManualPrint}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </div>
          ) : (
            <p className="no-print mb-4 text-center text-sm text-slate-500">
              Ouverture de l&apos;impression…
            </p>
          )}

          <article className="thermal-receipt w-full shrink-0 bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
          <header className="text-center">
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
              <span className="shrink-0">Caissière</span>
              <span className="min-w-0 break-words text-right">
                {receipt.cashierName ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0">Table / Réf.</span>
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

        {/* Espace bas : safe-area + barre mobile */}
        <div className="no-print h-8 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
