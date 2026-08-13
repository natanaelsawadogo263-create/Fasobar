"use client";

import Link from "next/link";
import { Lock, LogOut, Package } from "lucide-react";

import { getActivityPages } from "@/lib/activity/pages";
import { signOutAction } from "@/lib/auth/actions";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { useFasoBarCashier } from "@/components/fasobar/fasobar-cashier-context";
import { DesktopSyncIndicator } from "@/components/pos/desktop-sync-indicator";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import { LiveClock } from "@/components/ui/live-clock";

const iconBtn =
  "inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-200 transition active:bg-white/10 md:h-9 md:w-9 md:rounded-lg md:hover:bg-white/10";

export function FasoBarTopbar() {
  const ctx = useFasoBarCashier();
  const pages = getActivityPages(ctx?.caisseFilters?.activityCode);
  const openCount = ctx?.openOrdersCount ?? 0;
  const sessionOpen = Boolean(ctx?.hasSession);
  const cashierName = ctx?.cashierName?.trim() || "";
  const initials = initialsFromName(cashierName);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0b1220] px-3 pt-[env(safe-area-inset-top)] text-white md:h-[3.25rem] md:gap-3 md:px-4">
      {/* Gauche : marque + établissement */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 md:flex-none md:max-w-[240px]">
        <Link href="/application/caisse" className="shrink-0">
          <span className="md:hidden">
            <FasoBarLogo size="sm" tone="dark" markOnly />
          </span>
          <span className="hidden md:inline-flex">
            <FasoBarLogo size="sm" tone="dark" />
          </span>
        </Link>
        <div className="hidden h-8 w-px shrink-0 bg-white/10 sm:block" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">
            Caisse
          </p>
          <p className="truncate text-[13px] font-medium leading-tight text-white">
            {ctx?.establishmentName ?? "Maquis"}
          </p>
        </div>
      </div>

      {/* Centre : heure (desktop) */}
      <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
        <LiveClock variant="dark" inline className="gap-2 text-[12px]" />
      </div>

      {/* Droite : statut + actions */}
      <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
        <span
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${
            sessionOpen
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-white/8 text-slate-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              sessionOpen
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                : "bg-slate-500"
            }`}
            aria-hidden
          />
          {sessionOpen ? "Ouverte" : "Fermée"}
        </span>

        <div className="hidden lg:block">
          <DesktopSyncIndicator compact showIcon hideLabel />
        </div>

        <div className="mx-0.5 hidden h-6 w-px bg-white/10 sm:block" aria-hidden />

        {ctx?.onOpenOrders ? (
          <button
            type="button"
            onClick={ctx.onOpenOrders}
            className={`${iconBtn} relative`}
            title={pages.pos.openTicketsTitle}
            aria-label={`${pages.pos.openTicketsTitle}${openCount > 0 ? ` (${openCount})` : ""}`}
          >
            <Package className="h-4 w-4" />
            {openCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold leading-none text-white">
                {openCount > 99 ? "99+" : openCount}
              </span>
            ) : null}
          </button>
        ) : (
          <Link
            href="/application/commandes-ouvertes"
            className={`${iconBtn} relative`}
            title={pages.pos.openTicketsTitle}
            aria-label={`${pages.pos.openTicketsTitle}${openCount > 0 ? ` (${openCount})` : ""}`}
          >
            <Package className="h-4 w-4" />
            {openCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold leading-none text-white">
                {openCount > 99 ? "99+" : openCount}
              </span>
            ) : null}
          </Link>
        )}

        {sessionOpen ? (
          <button
            type="button"
            onClick={ctx?.onCloseSession}
            className={`${iconBtn} text-red-400 md:hover:bg-red-500/10`}
            title="Fermer la caisse"
            aria-label="Fermer la caisse"
          >
            <Lock className="h-4 w-4" />
          </button>
        ) : null}

        <div className="hidden md:block">
          <FullscreenButton
            showLabel={false}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10"
          />
        </div>

        <form action={signOutAction} className="flex items-center">
          <button
            type="submit"
            title="Déconnexion"
            aria-label="Déconnexion"
            className="inline-flex h-11 items-center gap-2 rounded-xl px-1 text-left active:bg-white/10 md:h-9 md:rounded-lg md:px-1.5 md:hover:bg-white/10"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300 md:h-7 md:w-7">
              {initials}
            </span>
            {cashierName ? (
              <span className="hidden max-w-[8.5rem] truncate text-[12px] font-medium text-slate-200 xl:inline">
                {cashierName}
              </span>
            ) : null}
            <LogOut className="hidden h-3.5 w-3.5 text-slate-400 xl:inline" />
          </button>
        </form>
      </div>
    </header>
  );
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CA";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
