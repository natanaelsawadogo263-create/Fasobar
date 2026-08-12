"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type EstablishmentLiveSyncProps = {
  establishmentId: string;
};

const REFRESH_DEBOUNCE_MS = 500;

/** Pages admin “statiques” : pas de refresh ops (évite de recharger tout le SSR). */
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
  if (pathname.startsWith("/application/cuisine")) return false;
  if (pathname.startsWith("/application/bar/commandes")) return false;
  return (
    pathname.startsWith("/application/caisse") ||
    pathname.startsWith("/application/commandes") ||
    pathname.startsWith("/application/bar") ||
    pathname.startsWith("/application/encaissement") ||
    pathname.startsWith("/application/commandes-ouvertes") ||
    pathname.startsWith("/application/tableau-de-bord") ||
    pathname.startsWith("/application/sessions") ||
    pathname.startsWith("/application/caisses") ||
    pathname.startsWith("/application/ventes")
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
    pathname.startsWith("/application/tableau-de-bord")
  );
}

/**
 * Abonnement Realtime établissement : rafraîchit le SSR sans naviguer ailleurs.
 * Scopé par page pour éviter les rechargements inutiles hors caisse / ops.
 */
export function EstablishmentLiveSync({ establishmentId }: EstablishmentLiveSyncProps) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!establishmentId) {
      return;
    }

    const supabase = createClient();
    const scheduleRefresh = (kind: "ops" | "catalog" | "any" = "any") => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const path = pathnameRef.current;
      if (shouldSkipOpsRefresh(path)) {
        return;
      }
      if (kind === "ops" && !isOpsSurface(path)) {
        return;
      }
      if (kind === "catalog" && !isCatalogSurface(path)) {
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        if (shouldSkipOpsRefresh(pathnameRef.current)) {
          return;
        }
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`ops-establishment:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => scheduleRefresh("ops"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => scheduleRefresh("ops"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_register_sessions",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => scheduleRefresh("ops"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bar_sessions",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => scheduleRefresh("ops"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => scheduleRefresh("catalog"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_items",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => scheduleRefresh("catalog"),
      )
      .subscribe();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, router]);

  return null;
}
