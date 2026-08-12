"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

import { formatPriceXof } from "@/lib/payments/constants";
import { formatOrderNumber } from "@/lib/orders/constants";
import type { OrderAddition } from "@/lib/payments/types";

type ThermalAdditionProps = {
  addition: OrderAddition;
  autoPrint?: boolean;
  /** Après impression, revenir ici (ex. caisse avec la même commande). */
  returnTo?: string | null;
};

/**
 * Ticket d'addition client (provisoire) — sans encaissement.
 * Réimprimable à chaque mise à jour de la commande jusqu'au paiement final.
 */
export function ThermalAddition({
  addition,
  autoPrint = false,
  returnTo = null,
}: ThermalAdditionProps) {
  const router = useRouter();
  const reference =
    addition.tableReference ?? addition.customerReference ?? "—";
  const unpaid = addition.paymentStatus !== "PAID";
  const redirectedRef = useRef(false);

  function goBack() {
    if (redirectedRef.current || !returnTo) return;
    redirectedRef.current = true;
    router.replace(returnTo);
  }

  useEffect(() => {
    if (!autoPrint) return;

    function handleAfterPrint() {
      goBack();
    }

    window.addEventListener("afterprint", handleAfterPrint);

    const timer = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goBack closes over returnTo/router
  }, [autoPrint, addition.orderId, returnTo, router]);

  function handleManualPrint() {
    window.addEventListener("afterprint", goBack, { once: true });
    window.print();
  }

  function formatReceiptCell(amount: number): string {
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(amount)} F`;
  }

  return (
    <div className="thermal-receipt-host relative min-h-0 w-full flex-1 basis-0">
      <div
        className="thermal-receipt-scroll absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto flex w-full max-w-[320px] flex-col items-center px-3 py-4 pb-12">
      <div className="no-print sticky top-0 z-10 mb-3 flex w-full flex-col items-center gap-2 bg-[#f4f6f9] py-2">
        <p className="text-center text-sm text-slate-500">
          Addition client {unpaid ? "(non payée)" : ""}
        </p>
        <button
          type="button"
          onClick={handleManualPrint}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Printer className="h-4 w-4" />
          Imprimer l&apos;addition
        </button>
      </div>

      <article className="thermal-receipt w-full shrink-0 bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
        <header className="text-center">
          {addition.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- impression thermique
            <img
              src={addition.logoUrl}
              alt=""
              className="receipt-logo mx-auto"
            />
          ) : (
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-700">
              FasoBar
            </p>
          )}
          <h1 className={`${addition.logoUrl ? "mt-1.5" : "mt-2"} text-base font-bold`}>
            {addition.establishmentName}
          </h1>
          {addition.establishmentAddress ? (
            <p className="mt-1 text-xs">{addition.establishmentAddress}</p>
          ) : null}
          {addition.establishmentPhone ? (
            <p className="text-xs">Tél. {addition.establishmentPhone}</p>
          ) : null}
          <p className="mt-2 text-sm font-bold uppercase tracking-wide">
            Addition
          </p>
          {unpaid ? (
            <p className="mt-1 text-[11px] font-semibold uppercase text-slate-700">
              Document provisoire — non payé
            </p>
          ) : null}
        </header>

        <div className="my-3 border-t border-dashed border-black" />

        <section className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Commande</span>
            <span className="font-semibold">
              {formatOrderNumber(addition.orderNumber)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>
              {new Date(addition.issuedAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Type</span>
            <span>{addition.orderTypeLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Table / Réf.</span>
            <span>{reference}</span>
          </div>
        </section>

        <div className="my-3 border-t border-dashed border-black" />

        <section>
          <table className="receipt-items w-full table-fixed text-[11px] leading-snug">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[12%]" />
              <col className="w-[26%]" />
              <col className="w-[26%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 pr-1 text-left font-semibold">Article</th>
                <th className="py-1 px-0.5 text-right font-semibold">Qté</th>
                <th className="py-1 px-0.5 text-right font-semibold">P.U.</th>
                <th className="py-1 pl-0.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {addition.items.map((item, index) => (
                <tr key={`${item.productName}-${index}`} className="align-top">
                  <td className="py-1 pr-1 break-words">{item.productName}</td>
                  <td className="receipt-amount py-1 px-0.5 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="receipt-amount py-1 px-0.5 text-right tabular-nums whitespace-nowrap">
                    {formatReceiptCell(item.unitPrice)}
                  </td>
                  <td className="receipt-amount py-1 pl-0.5 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatReceiptCell(item.lineTotal)}
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
            <span>{formatPriceXof(addition.subtotal)}</span>
          </div>
          {addition.discount > 0 ? (
            <div className="flex justify-between">
              <span>Remise</span>
              <span>−{formatPriceXof(addition.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm font-bold">
            <span>Total à payer</span>
            <span>{formatPriceXof(addition.total)}</span>
          </div>
        </section>

        <div className="my-4 border-t border-dashed border-black" />

        <footer className="pb-2 text-center text-xs">
          <p className="font-medium">Veuillez vérifier votre commande</p>
          <p className="mt-1 text-[10px] text-slate-600">
            {unpaid
              ? "Cette addition n'est pas un reçu de paiement."
              : "Commande déjà réglée."}
          </p>
        </footer>
      </article>

        <div className="no-print h-8 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
