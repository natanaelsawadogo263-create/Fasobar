"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type EstablishmentLiveSyncProps = {
  establishmentId: string;
};

const REFRESH_DEBOUNCE_MS = 900;

/**
 * Abonnement Realtime établissement : rafraîchit le SSR sans naviguer ailleurs.
 * Ignoré sur /acces-refuse et onglets cachés pour éviter les faux murs d'accès.
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
    const scheduleRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (pathnameRef.current?.includes("acces-refuse")) {
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        if (pathnameRef.current?.includes("acces-refuse")) {
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
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_register_sessions",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bar_sessions",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_items",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        scheduleRefresh,
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
