"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { ClipboardList, LayoutDashboard, LogOut } from "lucide-react";

import { CashSessionIndicator } from "@/components/pos/cash-session-indicator";
import { DesktopSyncIndicator } from "@/components/pos/desktop-sync-indicator";

type PosHeaderProps = {
  establishmentName: string;
  cashierName: string;
  sessionOpenedAt?: string;
  hasSession: boolean;
  onOpenOrders: () => void;
  onCloseSession: () => void;
};

export function PosHeader({
  establishmentName,
  cashierName,
  sessionOpenedAt,
  hasSession,
  onOpenOrders,
  onCloseSession,
}: PosHeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950 px-3 lg:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white sm:inline">
            FasoBar
          </span>
          <p className="truncate text-sm font-semibold text-white">{establishmentName}</p>
        </div>
        {hasSession ? (
          <div className="hidden min-w-0 md:block">
            <CashSessionIndicator
              isOpen={hasSession}
              cashierName={cashierName}
              openedAt={sessionOpenedAt}
              compact
            />
          </div>
        ) : null}
        <DesktopSyncIndicator compact />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenOrders}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800 lg:px-3 lg:text-sm"
          title="Commandes ouvertes (F4)"
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline">Commandes</span>
        </button>
        {hasSession ? (
          <button
            type="button"
            onClick={onCloseSession}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 text-slate-400 transition hover:border-red-900/50 hover:bg-red-950/40 hover:text-red-200 lg:w-auto lg:px-2.5 lg:gap-1.5"
            title="Fermer la caisse"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline text-xs font-medium">Fermer</span>
          </button>
        ) : null}
        <Link
          href="/application"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Retour au tableau de bord"
          title="Tableau de bord"
        >
          <LayoutDashboard className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
