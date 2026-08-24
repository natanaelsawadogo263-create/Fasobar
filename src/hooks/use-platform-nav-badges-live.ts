"use client";

import { useEffect, useRef, useState } from "react";

import { playFasoBarNotificationChime } from "@/lib/admin/notification-chime";
import type { PlatformNavBadges } from "@/lib/platform/navigation";

const POLL_MS = 20_000;

/**
 * Fait vivre les compteurs « À traiter » (ouvertures, paiements) tout au
 * long de la navigation Super Admin — sidebar, topbar, menu mobile — et
 * joue le son de notification FasoBar dès qu'une nouvelle demande arrive,
 * pas seulement pour les échéances (déjà géré par
 * usePlatformExpiryAlertsLive). `initial` est la valeur rendue côté serveur
 * à l'ouverture de la page ; elle sert de référence de départ, donc aucun
 * son ne joue tant que rien de nouveau n'est arrivé depuis.
 */
export function usePlatformNavBadgesLive(
  initial: PlatformNavBadges,
): PlatformNavBadges {
  const [badges, setBadges] = useState<PlatformNavBadges>(initial);
  const prevRef = useRef(initial);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const response = await fetch("/api/platform/nav-badges", {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;

        const next = (await response.json()) as PlatformNavBadges;
        const prev = prevRef.current;
        const hasNewActivity =
          next.openingRequests > prev.openingRequests ||
          next.subscriptionRequests > prev.subscriptionRequests;

        prevRef.current = next;
        setBadges(next);

        if (hasNewActivity) {
          void playFasoBarNotificationChime();
        }
      } catch (error) {
        console.error("[platform] nav badges hydrate failed:", error);
      }
    }

    const pollTimer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void hydrate();
    }, POLL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void hydrate();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return badges;
}
