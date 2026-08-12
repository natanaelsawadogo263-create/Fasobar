"use client";

import Link from "next/link";
import { Lock, Package } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { useFasoBarCashier } from "@/components/fasobar/fasobar-cashier-context";
import { DesktopSyncIndicator } from "@/components/pos/desktop-sync-indicator";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import { LiveClock } from "@/components/ui/live-clock";

export function FasoBarTopbar() {
  const ctx = useFasoBarCashier();
  const openCount = ctx?.openOrdersCount ?? 0;
  const sessionOpen = Boolean(ctx?.hasSession);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b border-white/10 bg-[#0b1220] px-3 pt-[env(safe-area-inset-top)] text-white md:h-12 md:gap-3 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link href="/application/caisse" className="shrink-0">
          <span className="md:hidden">
            <FasoBarLogo size="sm" tone="dark" markOnly />
          </span>
          <span className="hidden md:inline-flex">
            <FasoBarLogo size="sm" tone="dark" />
          </span>
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white md:text-[12px] md:font-normal md:text-slate-400">
            {ctx?.establishmentName ?? "Maquis"}
          </p>
          <p className="truncate text-[10px] text-slate-400 md:hidden">
            {sessionOpen ? "Caisse ouverte" : "Caisse fermée"}
            {ctx?.cashierName ? ` · ${ctx.cashierName}` : ""}
          </p>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden lg:flex">
        <LiveClock variant="dark" inline />
        <MetaSep />
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-300">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              sessionOpen
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                : "bg-slate-500"
            }`}
            aria-hidden
          />
          {sessionOpen ? "Caisse ouverte" : "Caisse fermée"}
        </span>
        <MetaSep />
        <span
          className="max-w-[150px] truncate text-[11px] text-slate-300"
          title={ctx?.cashierName ?? undefined}
        >
          {ctx?.cashierName ?? "—"}
        </span>
        <MetaSep />
        <DesktopSyncIndicator compact showIcon />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden md:block">
          <FullscreenButton
            showLabel={false}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 px-2 text-slate-200 transition hover:bg-white/10"
          />
        </div>

        {ctx?.onOpenOrders ? (
          <button
            type="button"
            onClick={ctx.onOpenOrders}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[11px] font-semibold text-slate-200 active:bg-white/10 md:h-8 md:rounded-md md:px-2.5"
            title="Commandes"
          >
            <Package className="h-4 w-4" />
            {openCount > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">
                {openCount}
              </span>
            ) : null}
          </button>
        ) : (
          <Link
            href="/application/commandes-ouvertes"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[11px] font-semibold text-slate-200 active:bg-white/10 md:h-8 md:rounded-md md:px-2.5"
            title="Commandes"
          >
            <Package className="h-4 w-4" />
            {openCount > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">
                {openCount}
              </span>
            ) : null}
          </Link>
        )}

        {sessionOpen ? (
          <button
            type="button"
            onClick={ctx?.onCloseSession}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[11px] font-semibold text-red-400 active:bg-red-500/10 md:h-8 md:rounded-md md:px-2.5"
            title="Fermer la caisse"
          >
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Fermer</span>
          </button>
        ) : null}

        <SignOutButton variant="dark" label="Déconnexion" compact />
      </div>
    </header>
  );
}

function MetaSep() {
  return (
    <span className="shrink-0 text-white/20" aria-hidden>
      ·
    </span>
  );
}
