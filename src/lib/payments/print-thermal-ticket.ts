/** Petit ticket imprimante thermique (80 mm), pas une page A4. */

const PRINTING_CLASS = "printing-ticket";
const CLONE_ID = "print-ticket-clone";
const PAGE_STYLE_ID = "thermal-print-page-style";

const THERMAL_PAGE_CSS = `
@page {
  size: 80mm auto;
  margin: 0;
}
`;

export function printThermalTicket(): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const ticket = document.querySelector<HTMLElement>(".thermal-receipt");

  document.getElementById(CLONE_ID)?.remove();
  document.getElementById(PAGE_STYLE_ID)?.remove();

  if (ticket) {
    const clone = ticket.cloneNode(true) as HTMLElement;
    clone.id = CLONE_ID;
    clone.classList.add("thermal-receipt");
    document.body.appendChild(clone);
  }

  const pageStyle = document.createElement("style");
  pageStyle.id = PAGE_STYLE_ID;
  pageStyle.textContent = THERMAL_PAGE_CSS;
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
