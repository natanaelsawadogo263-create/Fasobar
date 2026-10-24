"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { playFasoBarNotificationChime } from "@/lib/admin/notification-chime";
import { createClient } from "@/lib/supabase/client";
import { bindRealtimeAuth } from "@/lib/supabase/realtime-session";

const REFRESH_DEBOUNCE_MS = 400;
/** Filet de sécurité si le websocket tombe (réseau mobile). */
const FALLBACK_POLL_MS = 30_000;

/**
 * Commandes de livraison en direct : rafraîchit la page serveur à chaque
 * changement, et sonne quand une nouvelle commande arrive (`chimeOnNew`).
 */
export function useDeliveryOrdersLive(
  establishmentId: string,
  options: { chimeOnNew?: boolean; onChange?: () => void } = {},
) {
  const router = useRouter();
  const chimeOnNew = Boolean(options.chimeOnNew);
  const chimeRef = useRef(chimeOnNew);
  const onChangeRef = useRef(options.onChange);

  useEffect(() => {
    chimeRef.current = chimeOnNew;
    onChangeRef.current = options.onChange;
  }, [chimeOnNew, options.onChange]);

  useEffect(() => {
    if (!establishmentId) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unbindAuth: (() => void) | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
        onChangeRef.current?.();
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase.channel(`delivery-orders-${establishmentId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "delivery_orders",
        filter: `establishment_id=eq.${establishmentId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT" && chimeRef.current) {
          void playFasoBarNotificationChime({ force: true });
        }
        scheduleRefresh();
      },
    );

    void bindRealtimeAuth(supabase).then((unbind) => {
      if (cancelled) {
        unbind();
        return;
      }
      unbindAuth = unbind;
      channel.subscribe();
    });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        onChangeRef.current?.();
      }
    }, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      unbindAuth?.();
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, router]);
}
