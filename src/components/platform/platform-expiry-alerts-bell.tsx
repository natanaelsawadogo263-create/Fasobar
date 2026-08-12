"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { PlatformExpiryAlertCard } from "@/components/platform/platform-expiry-alert-card";
import type { PlatformExpiryAlert } from "@/lib/platform/expiry-alerts-types";

type Props = {
  alerts: PlatformExpiryAlert[];
  warningDays: number;
};

export function PlatformExpiryAlertsBell({ alerts, warningDays }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const count = alerts.length;

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Alertes d’échéance"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
          count > 0
            ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-700 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
        >
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-slate-900">
              Échéances sous {warningDays} jours
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Contactez le client (WhatsApp / appel / email) pour renouveler.
            </p>
          </div>
          <div className="app-scroll max-h-[min(70vh,28rem)] space-y-2 overflow-auto p-2.5">
            {count === 0 ? (
              <p className="px-2 py-6 text-center text-[12px] text-slate-500">
                Aucune échéance à surveiller.
              </p>
            ) : (
              alerts.map((alert) => (
                <PlatformExpiryAlertCard
                  key={alert.id}
                  alert={alert}
                  compact
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
