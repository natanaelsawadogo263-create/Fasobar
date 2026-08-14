import { formatOrderNumber } from "@/lib/orders/constants";
import { formatPriceXof } from "@/lib/payments/constants";
import type { OrderAddition } from "@/lib/payments/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCell(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} F`;
}

export function buildAdditionTicketHtml(addition: OrderAddition, title: string): string {
  const unpaid = addition.paymentStatus !== "PAID";
  const reference = addition.tableReference ?? addition.customerReference ?? "—";
  const issued = new Date(addition.issuedAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const logo = addition.logoUrl
    ? `<img src="${escapeHtml(addition.logoUrl)}" alt="" style="display:block;margin:0 auto 4px;max-height:16mm;max-width:32mm;" />`
    : `<p style="font-size:11px;font-weight:700;letter-spacing:.2em;margin:0;">FASOBAR</p>`;

  const rows = addition.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.productName)}</td>
        <td style="text-align:right;">${item.quantity}</td>
        <td style="text-align:right;white-space:nowrap;">${formatCell(item.unitPrice)}</td>
        <td style="text-align:right;white-space:nowrap;">${formatCell(item.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const discount =
    addition.discount > 0
      ? `<div class="row"><span>Remise</span><span>−${formatPriceXof(addition.discount)}</span></div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { display: flex; justify-content: center; }
    .ticket {
      width: 80mm; max-width: 80mm; padding: 3mm 4mm 8mm;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 11px; line-height: 1.35; color: #000;
    }
    h1 { font-size: 14px; margin: 6px 0 2px; text-align: center; }
    .center { text-align: center; }
    .muted { font-size: 10px; }
    .dash { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; vertical-align: top; }
    th { text-align: left; border-bottom: 1px solid #000; }
    th:not(:first-child), td:not(:first-child) { text-align: right; }
    .total { font-size: 13px; font-weight: 700; }
  </style>
</head>
<body>
  <article class="ticket">
    <div class="center">${logo}</div>
    <h1>${escapeHtml(addition.establishmentName)}</h1>
    ${addition.establishmentAddress ? `<p class="center muted">${escapeHtml(addition.establishmentAddress)}</p>` : ""}
    ${addition.establishmentPhone ? `<p class="center muted">Tél. ${escapeHtml(addition.establishmentPhone)}</p>` : ""}
    <p class="center" style="font-weight:700;margin:8px 0 0;">${escapeHtml(title.toUpperCase())}</p>
    ${unpaid ? `<p class="center muted" style="font-weight:700;">NON PAYÉ</p>` : ""}
    <div class="dash"></div>
    <div class="row"><span>Commande</span><strong>${formatOrderNumber(addition.orderNumber)}</strong></div>
    <div class="row"><span>Date</span><span>${issued}</span></div>
    <div class="row"><span>Type</span><span>${escapeHtml(addition.orderTypeLabel)}</span></div>
    <div class="row"><span>Table / Réf.</span><span>${escapeHtml(reference)}</span></div>
    <div class="dash"></div>
    <table>
      <thead><tr><th>Article</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="dash"></div>
    <div class="row"><span>Sous-total</span><span>${formatPriceXof(addition.subtotal)}</span></div>
    ${discount}
    <div class="row total"><span>Total à payer</span><span>${formatPriceXof(addition.total)}</span></div>
    <div class="dash"></div>
    <p class="center">Merci</p>
    <p class="center muted">${unpaid ? "Ceci n’est pas un reçu de paiement." : "Ticket déjà réglé."}</p>
  </article>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 80);
    });
    window.addEventListener("afterprint", function () {
      window.close();
    });
  </script>
</body>
</html>`;
}

export function openAdditionPrintWindow(): Window | null {
  if (typeof window === "undefined") return null;
  return window.open("about:blank", "fasobar-addition", "width=360,height=720");
}

export function writeAdditionPrintWindow(
  win: Window | null,
  html: string,
): void {
  if (!win || win.closed) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.addEventListener("afterprint", () => iframe.remove());
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}
