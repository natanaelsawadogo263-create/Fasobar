"use client";

import { useEffect, useRef } from "react";

import { playFasoBarNotificationChime } from "@/lib/admin/notification-chime";
import { useToastOptional } from "@/components/ui/toast";

/**
 * Joue un son (et un toast discret) dès qu’un nouveau ticket « à préparer » apparaît.
 * Le premier rendu ne sonne pas : ce sont les tickets déjà affichés.
 */
export function usePrepTicketChime(
  ticketIds: string[],
  toastMessage = "Nouvelle commande",
): void {
  const seenRef = useRef<Set<string> | null>(null);
  const toast = useToastOptional();

  useEffect(() => {
    const next = new Set(ticketIds);
    const previous = seenRef.current;
    seenRef.current = next;

    if (!previous) return;

    for (const id of next) {
      if (!previous.has(id)) {
        void playFasoBarNotificationChime();
        toast?.show(toastMessage, "info");
        break;
      }
    }
  }, [ticketIds, toast, toastMessage]);
}
