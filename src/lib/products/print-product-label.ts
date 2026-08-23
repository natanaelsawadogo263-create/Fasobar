/**
 * Impression d'étiquette produit (50 x 30 mm) — séparée de l'impression des tickets
 * de caisse (@thermal-receipt). Même principe : clone + classe html dédiée + @page.
 */

const PRINTING_CLASS = "printing-label";
const CLONE_ID = "print-label-clone";
const PAGE_STYLE_ID = "product-label-print-page-style";

const LABEL_PAGE_CSS = `
@page {
  size: 50mm 30mm;
  margin: 0;
}
`;

export function printProductLabel(): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const label = document.querySelector<HTMLElement>(".product-label");

  document.getElementById(CLONE_ID)?.remove();
  document.getElementById(PAGE_STYLE_ID)?.remove();

  if (label) {
    const clone = label.cloneNode(true) as HTMLElement;
    clone.id = CLONE_ID;
    clone.classList.add("product-label");
    document.body.appendChild(clone);
  }

  const pageStyle = document.createElement("style");
  pageStyle.id = PAGE_STYLE_ID;
  pageStyle.textContent = LABEL_PAGE_CSS;
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
