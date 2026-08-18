"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { LiveClock } from "@/components/ui/live-clock";
import { PlatformExpiryAlertsBell } from "@/components/platform/platform-expiry-alerts-bell";
import { signOutAction } from "@/lib/auth/actions";
import {
  resolvePlatformPageMeta,
  totalPendingActions,
  type PlatformNavBadges,
} from "@/lib/platform/navigation";
import type { PlatformExpiryAlert } from "@/lib/platform/expiry-alerts-types";

type PlatformTopbarProps = {
  adminEmail: string;
  adminName?: string | null;
  expiryAlerts?: PlatformExpiryAlert[];
  warningDaysBeforeExpiry?: number;
  navBadges: PlatformNavBadges;
};

function resolveDisplayName(
  adminName: string | null | undefined,
  adminEmail: string,
) {
  const trimmed = adminName?.trim() ?? "";
  if (!trimmed) return "Super Admin";
  if (trimmed.toLowerCase() === adminEmail.trim().toLowerCase()) {
    return "Super Admin";
  }
  if (trimmed.includes("@")) return "Super Admin";
  return trimmed;
}

function pendingActionsHref(badges: PlatformNavBadges): string {
  if (badges.openingRequests > 0) return "/platform/demandes-etablissement";
  if (badges.subscriptionRequests > 0) return "/platform/demandes-abonnement";
  return "/platform";
}

function ToolbarSeparator() {
  return (
    <span
      className="mx-0.5 hidden h-5 w-px shrink-0 bg-slate-200 md:block"
      aria-hidden
    />
  );
}

export function PlatformTopbar({
  adminEmail,
  adminName,
  expiryAlerts = [],
  warningDaysBeforeExpiry = 7,
  navBadges,
}: PlatformTopbarProps) {
  const pathname = usePathname();
  const page = resolvePlatformPageMeta(pathname);
  const displayName = resolveDisplayName(adminName, adminEmail);
  const pendingTotal = totalPendingActions(navBadges);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SA";

  useEffect(() => {
    if (!userMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  return (
    <header className="flex shrink-0 flex-col border-b border-slate-200/90 bg-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-12 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:h-[3.25rem] lg:px-5">
        <div className="mr-auto flex min-w-0 items-center gap-2.5">
          <div className="shrink-0 md:hidden">
            <FasoBarLogo size="sm" markOnly />
          </div>

          <div className="min-w-0">
            {page.sectionLabel ? (
              <nav
                aria-label="Fil d'Ariane"
                className="flex min-w-0 items-center gap-1 text-[13px]"
              >
                <span className="hidden shrink-0 font-medium text-slate-400 sm:inline">
                  {page.sectionLabel}
                </span>
                <ChevronRight
                  className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 sm:inline"
                  aria-hidden
                />
                <span className="truncate font-semibold tracking-tight text-slate-900">
                  {page.title}
                </span>
              </nav>
            ) : (
              <h1 className="truncate text-[13px] font-semibold tracking-tight text-slate-900 sm:text-[14px]">
                {page.title}
              </h1>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center rounded-xl border border-slate-200/90 bg-slate-50/70 p-0.5 shadow-sm">
          {pendingTotal > 0 ? (
            <>
              <Link
                href={pendingActionsHref(navBadges)}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[10px] font-bold tabular-nums text-amber-900 transition hover:bg-amber-100/80 sm:min-w-0 sm:px-2.5"
                title={`${pendingTotal} action${pendingTotal > 1 ? "s" : ""} à traiter`}
              >
                <span className="sm:hidden">{pendingTotal}</span>
                <span className="hidden sm:inline">
                  {pendingTotal} à traiter
                </span>
              </Link>
              <ToolbarSeparator />
            </>
          ) : null}

          <PlatformExpiryAlertsBell
            alerts={expiryAlerts}
            warningDays={warningDaysBeforeExpiry}
            embedded
          />

          <ToolbarSeparator />

          <LiveClock
            inline
            showDate={false}
            className="hidden min-w-0 px-1.5 md:inline-flex md:px-2 xl:hidden"
          />
          <LiveClock
            inline
            showDate
            className="hidden min-w-0 px-1.5 xl:inline-flex"
          />

          <ToolbarSeparator />

          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white"
              title={displayName}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 ring-2 ring-white">
                {initials}
              </span>
            </button>

            {userMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5"
              >
                <div className="border-b border-slate-100 px-3.5 py-2.5">
                  <p className="truncate text-[13px] font-semibold text-slate-900">
                    {displayName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {adminEmail}
                  </p>
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <LogOut className="h-3.5 w-3.5 text-slate-400" />
                    Se déconnecter
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
