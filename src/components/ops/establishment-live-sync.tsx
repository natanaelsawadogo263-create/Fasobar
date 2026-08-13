"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { unlockNotificationAudio } from "@/lib/admin/notification-chime";
import {
  cancelScheduledOpsRefresh,
  flushPendingOpsRefresh,
  scheduleOpsRefresh,
} from "@/lib/ops/schedule-refresh";
import { createClient } from "@/lib/supabase/client";

type EstablishmentLiveSyncProps = {
  establishmentId: string;
};

/** Pages admin « statiques » : pas de refresh ops (évite de recharger tout le SSR). */
function shouldSkipOpsRefresh(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.includes("acces-refuse")) return true;
  return (
    pathname.startsWith("/application/mon-abonnement") ||
    pathname.startsWith("/application/parametres") ||
    pathname.startsWith("/application/utilisateurs") ||
    pathname.startsWith("/abonnement")
  );
}

function isOpsSurface(pathname: string | null): boolean {
  if (!pathname) return true;
  return (
    pathname.startsWith("/application/caisse") ||
    pathname.startsWith("/application/commandes") ||
    pathname.startsWith("/application/bar") ||
    pathname.startsWith("/application/cuisine") ||
    pathname.startsWith("/application/encaissement") ||
    pathname.startsWith("/application/commandes-ouvertes") ||
    pathname.startsWith("/application/tableau-de-bord") ||
    pathname.startsWith("/application/sessions") ||
    pathname.startsWith("/application/caisses") ||
    pathname.startsWith("/application/ventes") ||
    pathname.startsWith("/application/depenses") ||
    pathname.startsWith("/application/inventaires") ||
    pathname.startsWith("/application/rapports") ||
    pathname.startsWith("/application/recus") ||
    pathname.startsWith("/application/stock")
  );
}

function isCatalogSurface(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/application/produits") ||
    pathname.startsWith("/application/stock") ||
    pathname.startsWith("/application/approvisionnements") ||
    pathname.startsWith("/application/bar/stock") ||
    pathname.startsWith("/application/bar/approvisionnements") ||
    pathname.startsWith("/application/tableau-de-bord") ||
    pathname.startsWith("/application/caisse") ||
    pathname.startsWith("/application/cuisine") ||
    pathname.startsWith("/application/bar")
  );
}

type LiveTable = {
  table: string;
  kind: "ops" | "catalog";
};

const LIVE_TABLES: LiveTable[] = [
  { table: "orders", kind: "ops" },
  { table: "order_items", kind: "ops" },
  { table: "payments", kind: "ops" },
  { table: "cash_register_sessions", kind: "ops" },
  { table: "bar_sessions", kind: "ops" },
  { table: "expenses", kind: "ops" },
  { table: "inventory_sessions", kind: "ops" },
  { table: "products", kind: "catalog" },
  { table: "stock_items", kind: "catalog" },
  { table: "stock_movements", kind: "catalog" },
];

/**
 * Abonnement Realtime établissement : rafraîchit le SSR sans naviguer.
 * Toutes les pages ops (caisse, bar, cuisine, admin) restent à jour tant
 * que l’utilisateur est connecté — sans F5.
 */
export function EstablishmentLiveSync({ establishmentId }: EstablishmentLiveSyncProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!establishmentId) return;

    const supabase = createClient();

    const requestRefresh = (kind: "ops" | "catalog") => {
      const path = pathnameRef.current;
      if (shouldSkipOpsRefresh(path)) return;
      if (kind === "ops" && !isOpsSurface(path)) return;
      if (kind === "catalog" && !isCatalogSurface(path)) return;
      scheduleOpsRefresh(() => {
        if (shouldSkipOpsRefresh(pathnameRef.current)) return;
        router.refresh();
      });
    };

    let channel = supabase.channel(`ops-establishment:${establishmentId}`);
    for (const { table, kind } of LIVE_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => requestRefresh(kind),
      );
    }

    channel.subscribe();

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      flushPendingOpsRefresh();
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancelScheduledOpsRefresh();
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, router]);

  return null;
}
