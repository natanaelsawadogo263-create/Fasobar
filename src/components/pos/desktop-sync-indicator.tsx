"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

import {
  resolveDesktopConnectivityLabel,
  type DesktopConnectivityLabel,
} from "@/lib/desktop/connectivity-label";

function tone(label: DesktopConnectivityLabel): string {
  if (label === "Mode hors connexion") return "text-amber-400";
  if (label === "Synchronisation") return "text-sky-400";
  return "text-emerald-400";
}

/**
 * Connectivity / sync pill — polls health, auto-pushes outbox + catalog on reconnect.
 */
export function DesktopSyncIndicator({
  compact = false,
  showIcon = false,
}: {
  compact?: boolean;
  showIcon?: boolean;
}) {
  const [label, setLabel] = useState<DesktopConnectivityLabel>("En ligne");
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const health = await fetch("/api/desktop/health", { cache: "no-store" });
        if (!health.ok) {
          if (!cancelled) {
            wasOfflineRef.current = true;
            setLabel("Mode hors connexion");
          }
          return;
        }
        const json = (await health.json()) as {
          syncStatus?: string;
          connectivity?: { cloudReachable?: boolean };
        };
        const reachable = json.connectivity?.cloudReachable;
        const next = resolveDesktopConnectivityLabel(json.syncStatus, reachable);
        if (!cancelled) setLabel(next);

        const online =
          reachable === true &&
          json.syncStatus !== "OFFLINE" &&
          next !== "Mode hors connexion";

        if (online) {
          const reconnected = wasOfflineRef.current;
          wasOfflineRef.current = false;

          if (
            reconnected ||
            json.syncStatus === "ONLINE_PENDING" ||
            json.syncStatus === "SYNCING"
          ) {
            await fetch("/api/desktop/sync", { method: "POST" }).catch(() => null);
          }
          if (reconnected) {
            await fetch("/api/desktop/catalog/sync", { method: "POST" }).catch(
              () => null,
            );
          }
        } else {
          wasOfflineRef.current = true;
        }
      } catch {
        if (!cancelled) {
          wasOfflineRef.current = true;
          setLabel("Mode hors connexion");
        }
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const Icon = label === "Mode hors connexion" ? WifiOff : Wifi;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 ${compact ? "text-[11px]" : "text-xs"} text-slate-400`}
      title={label}
      aria-live="polite"
    >
      {showIcon ? (
        <Icon className={`h-3.5 w-3.5 ${tone(label)}`} aria-hidden />
      ) : (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            label === "Mode hors connexion"
              ? "bg-amber-400"
              : label === "Synchronisation"
                ? "bg-sky-400"
                : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
          }`}
          aria-hidden
        />
      )}
      <span className={tone(label)}>{label}</span>
    </span>
  );
}
