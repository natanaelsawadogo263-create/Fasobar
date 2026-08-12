"use client";

/** Rafraîchit le RSC hors de la transition bouton (clic immédiat). */
export function refreshSoon(refresh: () => void) {
  window.setTimeout(refresh, 0);
}
