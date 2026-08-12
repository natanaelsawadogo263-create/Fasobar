"use client";

import Link from "next/link";
import { Lock, Package, Truck, Wallet } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { useFasoBarCashier } from "@/components/fasobar/fasobar-cashier-context";
import { DesktopSyncIndicator } from "@/components/pos/desktop-sync-indicator";
import { LiveClock } from "@/components/ui/live-clock";

export function FasoBarTopbar() {
  const ctx = useFasoBarCashier();
  const openCount = ctx?.openOrdersCount ?? 0;
  const sessionOpen = Boolean(ctx?.hasSession);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b border-white/10 bg-[#0b1220] px-3 pt-[env(safe-area-inset-top)] text-white md:h-12 md:gap-4 md:px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <Link href="/application/caisse" className="shrink-0">
          <FasoBarLogo size="sm" tone="dark" />
        </Link>
        <span className="hidden text-white/20 sm:inline" aria-hidden>
          |
        </span>
        <span className="max-w-[28vw] truncate text-[12px] text-slate-400 sm:max-w-[140px]">
          {ctx?.establishmentName ?? "Maquis"}
        </span>
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

      <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
        <div className="flex items-center gap-0.5 md:gap-1">
          <TopLink href="/application/depenses" icon={Wallet} label="Dépenses" />
          <TopLink
            href="/application/approvisionnements"
            icon={Truck}
            label="Appro"
          />
          {ctx?.onOpenOrders ? (
            <button
              type="button"
              onClick={ctx.onOpenOrders}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold text-slate-200 active:bg-white/10 md:h-8 md:rounded-md md:font-medium"
            >
              <Package className="h-4 w-4 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">Commandes</span>
              {openCount > 0 ? (
                <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">
                  {openCount}
                </span>
              ) : null}
            </button>
          ) : (
            <Link
              href="/application/commandes-ouvertes"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold text-slate-200 active:bg-white/10 md:h-8 md:rounded-md md:font-medium"
            >
              <Package className="h-4 w-4 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">Commandes</span>
              {openCount > 0 ? (
                <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">
                  {openCount}
                </span>
              ) : null}
            </Link>
          )}
        </div>

        <span className="hidden h-5 w-px bg-white/15 sm:block" aria-hidden />

        {sessionOpen ? (
          <button
            type="button"
            onClick={ctx?.onCloseSession}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold text-red-400 active:bg-red-500/10 md:h-8 md:rounded-md"
          >
            <Lock className="h-4 w-4 md:h-3.5 md:w-3.5" />
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

function TopLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold text-slate-200 active:bg-white/10 md:h-8 md:rounded-md md:font-medium"
      title={label}
    >
      <Icon className="h-4 w-4 md:h-3.5 md:w-3.5" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
