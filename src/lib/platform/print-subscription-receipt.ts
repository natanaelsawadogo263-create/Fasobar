/** Reçu de paiement d'abonnement — page A4, imprimable / exportable en PDF
 * via la boîte de dialogue d'impression du navigateur (« Enregistrer en PDF »).
 * Même principe que print-thermal-ticket.ts (clone isolé + @page dédiée),
 * adapté au format A4 plutôt qu'au ticket 80mm. */

const PRINTING_CLASS = "printing-subscription-receipt";
const CLONE_ID = "print-subscription-receipt-clone";
const PAGE_STYLE_ID = "subscription-receipt-print-page-style";

const A4_PAGE_CSS = `
@page {
  size: A4 portrait;
  margin: 14mm 16mm;
}
`;

export function printSubscriptionReceipt(): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const receipt = document.querySelector<HTMLElement>(".subscription-receipt");

  document.getElementById(CLONE_ID)?.remove();
  document.getElementById(PAGE_STYLE_ID)?.remove();

  if (receipt) {
    const clone = receipt.cloneNode(true) as HTMLElement;
    clone.id = CLONE_ID;
    clone.classList.add("subscription-receipt");
    document.body.appendChild(clone);
  }

  const pageStyle = document.createElement("style");
  pageStyle.id = PAGE_STYLE_ID;
  pageStyle.textContent = A4_PAGE_CSS;
  document.head.appendChild(pageStyle);

  root.classList.add(PRINTING_CLASS);

  function cleanup() {
    root.classList.remove(PRINTING_CLASS);
    document.getElementById(CLONE_ID)?.remove();
    document.getElementById(PAGE_STYLE_ID)?.remove();
    window.removeEventListener("afterprint", cleanup);
  }

  window.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 30_000);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.print();
    });
  });
}
