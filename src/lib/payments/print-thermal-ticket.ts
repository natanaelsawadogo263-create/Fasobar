/** Impression d'un seul ticket (évite le doublon Chrome sur les zones overflow). */

const PRINTING_CLASS = "printing-ticket";
const CLONE_ID = "print-ticket-clone";

export function printThermalTicket(): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const ticket = document.querySelector<HTMLElement>(".thermal-receipt");

  document.getElementById(CLONE_ID)?.remove();

  if (ticket) {
    const clone = ticket.cloneNode(true) as HTMLElement;
    clone.id = CLONE_ID;
    clone.classList.add("thermal-receipt");
    document.body.appendChild(clone);
  }

  root.classList.add(PRINTING_CLASS);

  function cleanup() {
    root.classList.remove(PRINTING_CLASS);
    document.getElementById(CLONE_ID)?.remove();
    window.removeEventListener("afterprint", cleanup);
  }

  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 2000);
}
