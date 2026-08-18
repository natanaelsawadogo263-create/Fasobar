"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { PlatformExpiryAlertCard } from "@/components/platform/platform-expiry-alert-card";
import { usePlatformExpiryAlertsLive } from "@/hooks/use-platform-expiry-alerts-live";
import { playFasoBarNotificationChime } from "@/lib/admin/notification-chime";
import { markPlatformExpiryAlertsReadAction } from "@/lib/platform/expiry-alerts-actions";
import type { PlatformExpiryAlert } from "@/lib/platform/expiry-alerts-types";

type Props = {
  alerts: PlatformExpiryAlert[];
  warningDays: number;
  embedded?: boolean;
};

export function PlatformExpiryAlertsBell({
  alerts: initialAlerts,
  warningDays: initialWarningDays,
  embedded = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const live = usePlatformExpiryAlertsLive(initialAlerts, initialWarningDays);

  useEffect(() => {
    live.setOpen(open);
  }, [open, live.setOpen]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    live.unlock();
    void playFasoBarNotificationChime({ force: true });
    const next = !open;
    setOpen(next);
    if (next && live.unreadCount > 0) {
      const alertIds = live.alerts.map((alert) => alert.id);
      live.markAllReadLocal();
      startTransition(async () => {
        await markPlatformExpiryAlertsReadAction(alertIds);
      });
    }
  }

  const unreadCount = live.unreadCount;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Alertes d’échéance : ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
            : "Alertes d’échéance"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
          embedded
            ? unreadCount > 0
              ? "bg-amber-100/80 text-amber-900 hover:bg-amber-100"
              : "text-slate-600 hover:bg-white"
            : unreadCount > 0
              ? "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-700 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">
                Échéances sous {live.warningDays} jours
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Contactez le client pour renouveler.
              </p>
            </div>
            <span className="text-[11px] text-slate-400">
              {isPending
                ? "…"
                : unreadCount > 0
                  ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                  : "À jour"}
            </span>
          </div>
          <div className="app-scroll max-h-[min(70vh,28rem)] space-y-2 overflow-auto p-2.5">
            {live.alerts.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12px] text-slate-500">
                Aucune échéance à surveiller.
              </p>
            ) : (
              live.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={alert.read ? "opacity-60" : undefined}
                >
                  <PlatformExpiryAlertCard alert={alert} compact />
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
