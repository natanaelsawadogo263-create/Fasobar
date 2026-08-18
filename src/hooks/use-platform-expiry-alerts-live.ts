"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  playFasoBarNotificationChime,
  unlockNotificationAudio,
} from "@/lib/admin/notification-chime";
import type { PlatformExpiryAlert } from "@/lib/platform/expiry-alerts-types";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 20_000;

type AlertItem = PlatformExpiryAlert & { read: boolean };

function toItems(
  incoming: PlatformExpiryAlert[],
  readIds: Set<string>,
): AlertItem[] {
  return incoming.map((alert) => ({
    ...alert,
    read: readIds.has(alert.id),
  }));
}

async function fetchReadIds(alertIds: string[]): Promise<Set<string>> {
  if (alertIds.length === 0) return new Set();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("platform_expiry_alert_reads")
    .select("alert_id")
    .eq("user_id", user.id)
    .in("alert_id", alertIds);

  if (error) {
    if (/does not exist|schema cache|PGRST205/i.test(error.message)) {
      return new Set();
    }
    console.error("[platform] expiry alert reads:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => String(row.alert_id)));
}

export function usePlatformExpiryAlertsLive(
  initialAlerts: PlatformExpiryAlert[],
  warningDays: number,
) {
  const [alerts, setAlerts] = useState<AlertItem[]>(() =>
    toItems(initialAlerts, new Set()),
  );
  const [liveWarningDays, setLiveWarningDays] = useState(warningDays);
  const [unreadCount, setUnreadCount] = useState(initialAlerts.length);
  const knownIdsRef = useRef(new Set<string>());
  const readIdsRef = useRef(new Set<string>());
  const readyRef = useRef(false);
  const openRef = useRef(false);

  const applyAlerts = useCallback(
    (
      incoming: PlatformExpiryAlert[],
      nextWarningDays: number,
      readIds: Set<string>,
      options: { announceNew: boolean },
    ) => {
      readIdsRef.current = readIds;
      setLiveWarningDays(nextWarningDays);

      const freshUnread: PlatformExpiryAlert[] = [];
      for (const alert of incoming) {
        const isNew = !knownIdsRef.current.has(alert.id);
        knownIdsRef.current.add(alert.id);
        if (isNew && !readIds.has(alert.id)) {
          freshUnread.push(alert);
        }
      }

      const nextItems = toItems(incoming, readIds);
      setAlerts(nextItems);
      setUnreadCount(nextItems.filter((item) => !item.read).length);

      if (
        options.announceNew &&
        readyRef.current &&
        freshUnread.length > 0 &&
        !openRef.current
      ) {
        void playFasoBarNotificationChime();
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const readIds = await fetchReadIds(initialAlerts.map((item) => item.id));
      if (cancelled) return;
      for (const alert of initialAlerts) {
        knownIdsRef.current.add(alert.id);
      }
      readyRef.current = true;
      applyAlerts(initialAlerts, warningDays, readIds, { announceNew: false });
    })();

    async function hydrate(announceNew: boolean) {
      try {
        const response = await fetch("/api/platform/expiry-alerts", {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;

        const payload = (await response.json()) as {
          alerts?: PlatformExpiryAlert[];
          warningDays?: number;
        };
        const incoming = payload.alerts ?? [];
        const nextWarningDays = payload.warningDays ?? warningDays;
        const readIds = await fetchReadIds(incoming.map((item) => item.id));
        if (cancelled) return;

        if (!readyRef.current) {
          for (const alert of incoming) {
            knownIdsRef.current.add(alert.id);
          }
          readyRef.current = true;
        }

        applyAlerts(incoming, nextWarningDays, readIds, {
          announceNew: announceNew && readyRef.current,
        });
      } catch (error) {
        console.error("[platform] expiry alerts hydrate failed:", error);
      }
    }

    void hydrate(true);

    const pollTimer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void hydrate(true);
    }, POLL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void hydrate(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [applyAlerts, initialAlerts, warningDays]);

  const setOpen = useCallback((open: boolean) => {
    openRef.current = open;
  }, []);

  const markAllReadLocal = useCallback(() => {
    setAlerts((prev) => {
      for (const item of prev) {
        readIdsRef.current.add(item.id);
      }
      const next = prev.map((item) => ({ ...item, read: true }));
      setUnreadCount(0);
      return next;
    });
  }, []);

  return {
    alerts,
    warningDays: liveWarningDays,
    unreadCount,
    setOpen,
    markAllReadLocal,
    unlock: unlockNotificationAudio,
  };
}
