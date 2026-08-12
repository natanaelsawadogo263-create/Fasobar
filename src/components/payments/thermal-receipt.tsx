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
    <div className="thermal-receipt-page mx-auto max-w-md px-4 py-6">
      {!autoPrint ? (
        <div className="no-print mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleManualPrint}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
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

      <article className="thermal-receipt mx-auto bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
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
          <div className="flex justify-between">
            <span>Reçu</span>
            <span className="font-semibold">{formatReceiptNumber(receipt.receiptNumber)}</span>
          </div>
          <div className="flex justify-between">
            <span>Commande</span>
            <span>{formatOrderNumber(receipt.orderNumber)}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>
              {new Date(receipt.issuedAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Caissière</span>
            <span>{receipt.cashierName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Table / Réf.</span>
            <span>{reference}</span>
          </div>
        </section>

        <div className="my-3 border-t border-dashed border-black" />

        <section>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 text-left font-semibold">Article</th>
                <th className="py-1 text-right font-semibold">Qté</th>
                <th className="py-1 text-right font-semibold">P.U.</th>
                <th className="py-1 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, index) => (
                <tr key={`${item.productName}-${index}`} className="align-top">
                  <td className="py-1 pr-2">{item.productName}</td>
                  <td className="py-1 text-right">{item.quantity}</td>
                  <td className="py-1 text-right">{formatPriceXof(item.unitPrice)}</td>
                  <td className="py-1 text-right font-medium">
                    {formatPriceXof(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="my-3 border-t border-dashed border-black" />

        <section className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span>{formatPriceXof(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Remise</span>
            <span>{formatPriceXof(receipt.discount)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span>{formatPriceXof(receipt.total)}</span>
          </div>
        </section>

        <div className="my-3 border-t border-dashed border-black" />

        <section className="space-y-1 text-xs">
          <p className="font-semibold">Paiements</p>
          {receipt.payments.map((payment, index) => (
            <div key={`${payment.method}-${index}`} className="flex justify-between">
              <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
              <span>{formatPriceXof(payment.amountApplied)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1 font-semibold">
            <span>Montant reçu</span>
            <span>{formatPriceXof(receipt.paid)}</span>
          </div>
          {receipt.change > 0 ? (
            <div className="flex justify-between">
              <span>Monnaie rendue</span>
              <span>{formatPriceXof(receipt.change)}</span>
            </div>
          ) : null}
        </section>

        <div className="my-4 border-t border-dashed border-black" />

        <footer className="text-center text-xs">
          <p className="font-medium">Merci pour votre visite !</p>
          <p className="mt-1 text-[10px] text-slate-600">À bientôt chez {receipt.establishmentName}</p>
        </footer>
      </article>
    </div>
  );
}
