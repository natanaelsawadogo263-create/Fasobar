"use client";

import { Circle } from "lucide-react";

type CashSessionIndicatorProps = {
  isOpen: boolean;
  cashierName: string;
  openedAt?: string;
  online?: boolean;
  compact?: boolean;
};

export function CashSessionIndicator({
  isOpen,
  cashierName,
  openedAt,
  online = true,
  compact = false,
}: CashSessionIndicatorProps) {
  const openedLabel = openedAt
    ? new Date(openedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 truncate text-[11px] text-slate-400">
        <span className="inline-flex shrink-0 items-center gap-1">
          <Circle
            className={`h-1.5 w-1.5 fill-current ${isOpen ? "text-emerald-400" : "text-amber-400"}`}
            aria-hidden="true"
          />
          <span className="font-medium text-slate-300">
            {isOpen ? "Ouverte" : "Fermée"}
          </span>
        </span>
        <span className="truncate text-slate-500">{cashierName}</span>
        {openedLabel ? <span className="shrink-0 text-slate-600">· {openedLabel}</span> : null}
        <span className="inline-flex shrink-0 items-center gap-0.5">
          <Circle
            className={`h-1.5 w-1.5 fill-current ${online ? "text-emerald-400" : "text-red-400"}`}
            aria-hidden="true"
          />
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <Circle
          className={`h-2 w-2 fill-current ${isOpen ? "text-emerald-400" : "text-amber-400"}`}
          aria-hidden="true"
        />
        <span className="font-medium text-slate-200">
          {isOpen ? "Caisse ouverte" : "Caisse fermée"}
        </span>
      </span>
      <span>{cashierName}</span>
      {openedLabel ? <span>depuis {openedLabel}</span> : null}
      <span className="inline-flex items-center gap-1">
        <Circle
          className={`h-1.5 w-1.5 fill-current ${online ? "text-emerald-400" : "text-red-400"}`}
          aria-hidden="true"
        />
        {online ? "En ligne" : "Mode hors connexion"}
      </span>
    </div>
  );
}
