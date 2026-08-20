"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  playFasoBarNotificationChime,
  unlockNotificationAudio,
} from "@/lib/admin/notification-chime";
import type {
  AdminNotificationItem,
  AdminNotificationKind,
} from "@/lib/admin/notification-types";
import { bindRealtimeAuth } from "@/lib/supabase/realtime-session";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

const OPS_HYDRATE_DELAY_MS = 450;
/** Realtime + visibilité suffisent — pas de polling agressif sur chaque page admin. */
const FALLBACK_POLL_MS = 90_000;

const OPS_TABLES = [
  "orders",
  "payments",
  "expenses",
  "stock_movements",
  "cash_register_sessions",
  "bar_sessions",
  "admin_notifications",
] as const;

type NotificationRow = {
  id?: string;
  kind?: string;
  title?: string;
  body?: string | null;
  href?: string | null;
  created_at?: string;
};

function toItem(row: NotificationRow): AdminNotificationItem | null {
  if (!row.id) return null;
  return {
    id: row.id,
    kind: (row.kind as AdminNotificationKind) ?? "SALE",
    title: row.title?.trim() || "Nouvelle activité",
    body: row.body ?? null,
    href: row.href ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    read: false,
  };
}

function mergeItems(
  current: AdminNotificationItem[],
  incoming: AdminNotificationItem[],
): AdminNotificationItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? { ...item, read: existing.read } : item);
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);
}

export function useAdminNotificationsLive(establishmentId: string) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const knownIdsRef = useRef(new Set<string>());
  const readyRef = useRef(false);
  const openRef = useRef(false);

  useEffect(() => {
    if (!establishmentId) return;

    let cancelled = false;
    const supabase = createClient();
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
    const live = {
      unbindAuth: null as (() => void) | null,
      opsChannel: null as ReturnType<typeof supabase.channel> | null,
      broadcastChannel: null as ReturnType<typeof supabase.channel> | null,
    };

    const announce = (item: AdminNotificationItem) => {
      void playFasoBarNotificationChime();
      toastRef.current.show(item.title, "info");
    };

    const ingest = (
      incoming: AdminNotificationItem[],
      options: { announceNew: boolean },
    ) => {
      if (cancelled || incoming.length === 0) return;

      const fresh: AdminNotificationItem[] = [];
      for (const item of incoming) {
        if (!knownIdsRef.current.has(item.id)) {
          knownIdsRef.current.add(item.id);
          fresh.push(item);
        }
      }

      setItems((prev) => mergeItems(prev, incoming));

      if (!options.announceNew || !readyRef.current || fresh.length === 0) {
        return;
      }

      if (!openRef.current) {
        setUnreadCount((count) => count + fresh.length);
      }
      announce(fresh[0]!);
    };

    async function hydrate(announceNew: boolean) {
      const { data: rows, error } = await supabase
        .from("admin_notifications")
        .select("id, kind, title, body, href, created_at")
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (cancelled) return;
      if (error) {
        readyRef.current = true;
        return;
      }
      if (!rows) return;

      if (!readyRef.current) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;

        const ids = rows.map((row) => row.id);
        const { data: reads } =
          user && ids.length > 0
            ? await supabase
                .from("admin_notification_reads")
                .select("notification_id")
                .eq("user_id", user.id)
                .in("notification_id", ids)
            : { data: [] as Array<{ notification_id: string }> };

        const readIds = new Set(
          (reads ?? []).map((row) => String(row.notification_id)),
        );
        const nextItems: AdminNotificationItem[] = rows.map((row) => ({
          id: row.id,
          kind: (row.kind as AdminNotificationKind) ?? "SALE",
          title: row.title,
          body: row.body,
          href: row.href,
          createdAt: row.created_at,
          read: readIds.has(row.id),
        }));
        for (const item of nextItems) {
          knownIdsRef.current.add(item.id);
        }
        setItems(nextItems);
        setUnreadCount(nextItems.filter((item) => !item.read).length);
        readyRef.current = true;
        return;
      }

      ingest(
        rows.map((row) => ({
          id: row.id,
          kind: (row.kind as AdminNotificationKind) ?? "SALE",
          title: row.title,
          body: row.body,
          href: row.href,
          createdAt: row.created_at,
          read: false,
        })),
        { announceNew },
      );
    }

    const scheduleHydrate = () => {
      if (hydrateTimer) clearTimeout(hydrateTimer);
      hydrateTimer = setTimeout(() => {
        void hydrate(true);
      }, OPS_HYDRATE_DELAY_MS);
    };

    void (async () => {
      live.unbindAuth = await bindRealtimeAuth(supabase);
      if (cancelled) return;

      await hydrate(false);
      if (cancelled) return;

      pollTimer = setInterval(() => {
        if (document.visibilityState === "hidden" || openRef.current) return;
        void hydrate(true);
      }, FALLBACK_POLL_MS);

      let channel = supabase.channel(`admin-live:${establishmentId}`);
      for (const table of OPS_TABLES) {
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `establishment_id=eq.${establishmentId}`,
          },
          (payload) => {
            if (table === "admin_notifications" && payload.eventType === "INSERT") {
              const item = toItem(payload.new as NotificationRow);
              if (item) ingest([item], { announceNew: true });
              return;
            }
            scheduleHydrate();
          },
        );
      }
      live.opsChannel = channel.subscribe();

      live.broadcastChannel = supabase
        .channel(`fasobar-admin:${establishmentId}`)
        .on("broadcast", { event: "new" }, (message) => {
          const item = toItem((message.payload ?? {}) as NotificationRow);
          if (item) ingest([item], { announceNew: true });
        })
        .subscribe();
    })();

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void hydrate(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (pollTimer) clearInterval(pollTimer);
      if (hydrateTimer) clearTimeout(hydrateTimer);
      live.unbindAuth?.();
      if (live.opsChannel) void supabase.removeChannel(live.opsChannel);
      if (live.broadcastChannel) void supabase.removeChannel(live.broadcastChannel);
    };
  }, [establishmentId]);

  const setOpen = useCallback((open: boolean) => {
    openRef.current = open;
  }, []);

  const markAllReadLocal = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  }, []);

  return {
    items,
    unreadCount,
    setOpen,
    markAllReadLocal,
    unlock: unlockNotificationAudio,
  };
}
