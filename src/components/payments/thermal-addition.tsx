"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

import { formatPriceXof } from "@/lib/payments/constants";
import { printThermalTicket } from "@/lib/payments/print-thermal-ticket";
import { formatOrderNumber } from "@/lib/orders/constants";
import { getActivityPages } from "@/lib/activity/pages";
import type { OrderAddition } from "@/lib/payments/types";

type ThermalAdditionProps = {
  addition: OrderAddition;
  returnTo?: string | null;
  activityCode?: string | null;
};

function formatReceiptCell(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount)} F`;
}

export function ThermalAddition({
  addition,
  returnTo = null,
  activityCode = null,
}: ThermalAdditionProps) {
  const pages = getActivityPages(activityCode);
  const router = useRouter();
  const reference =
    addition.tableReference ?? addition.customerReference ?? "—";
  const unpaid = addition.paymentStatus !== "PAID";
  const homePath = returnTo || "/application/caisse";
  const returnedRef = useRef(false);
  const [showRetry, setShowRetry] = useState(false);

  function returnHome() {
    if (returnedRef.current) return;
    returnedRef.current = true;
    router.replace(homePath);
  }

  useEffect(() => {
    function onDone() {
      returnHome();
    }
    window.addEventListener("afterprint", onDone);
    const printTimer = window.setTimeout(() => {
      printThermalTicket();
    }, 80);
    const retryTimer = window.setTimeout(() => {
      setShowRetry(true);
    }, 2500);
    return () => {
      window.removeEventListener("afterprint", onDone);
      window.clearTimeout(printTimer);
      window.clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addition.orderId]);

  function handlePrint() {
    window.addEventListener("afterprint", returnHome, { once: true });
    printThermalTicket();
  }

  return (
    <div className="thermal-receipt-host flex min-h-0 w-full flex-1 flex-col bg-white">
      {showRetry ? (
        <div className="no-print shrink-0 px-3 py-3">
          <button
            type="button"
            onClick={handlePrint}
            className="mx-auto flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-semibold text-white"
          >
            <Printer className="h-5 w-5" />
            Imprimer
          </button>
        </div>
      ) : null}

      <div
        className="thermal-receipt-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 py-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <article className="thermal-receipt w-[80mm] max-w-full shrink-0 rounded-sm bg-white p-3 text-black shadow-md ring-1 ring-slate-300">
          <header className="thermal-receipt-header text-center">
            {addition.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- impression thermique
              <img src={addition.logoUrl} alt="" className="receipt-logo mx-auto" />
            ) : (
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-700">
                FasoBar
              </p>
            )}
            <h2 className={`${addition.logoUrl ? "mt-1.5" : "mt-2"} text-base font-bold`}>
              {addition.establishmentName}
            </h2>
            {addition.establishmentAddress ? (
              <p className="mt-1 text-xs">{addition.establishmentAddress}</p>
            ) : null}
            {addition.establishmentPhone ? (
              <p className="text-xs">Tél. {addition.establishmentPhone}</p>
            ) : null}
            <p className="mt-2 text-sm font-bold uppercase tracking-wide">
              {pages.pos.additionLabel}
            </p>
            {unpaid ? (
              <p className="mt-1 text-[11px] font-semibold uppercase text-slate-700">
                Non payé
              </p>
            ) : null}
          </header>

          <div className="my-3 border-t border-dashed border-black" />

          <section className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>{pages.retail ? "Ticket" : "Commande"}</span>
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
            {pages.retail ? null : (
              <div className="flex justify-between">
                <span>Type</span>
                <span>{addition.orderTypeLabel}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{pages.tickets.clientColumn}</span>
              <span>{reference}</span>
            </div>
          </section>

          <div className="my-3 border-t border-dashed border-black" />

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
            <p className="font-medium">Merci</p>
            <p className="mt-1 text-[10px] text-slate-600">
              {unpaid
                ? "Ceci n’est pas un reçu de paiement."
                : "Ticket déjà réglé."}
            </p>
          </footer>
        </article>
        <div className="no-print h-8 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
