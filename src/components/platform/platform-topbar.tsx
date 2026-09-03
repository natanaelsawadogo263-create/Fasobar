"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, LayoutDashboard, LogOut } from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { LiveClock } from "@/components/ui/live-clock";
import { EnablePushButton } from "@/components/notifications/enable-push-button";
import { PLATFORM_NAV_ICONS } from "@/components/platform/platform-sidebar";
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

function TopbarDivider() {
  return (
    <span
      className="mx-0.5 hidden h-6 w-px shrink-0 bg-slate-200 md:block"
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
  const SectionIcon = (page.href && PLATFORM_NAV_ICONS[page.href]) || LayoutDashboard;

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
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4 lg:h-16 lg:px-6">
        {/* Identité de la page */}
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <div className="shrink-0 md:hidden">
            <FasoBarLogo size="sm" markOnly />
          </div>

          <span
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 sm:inline-flex"
            aria-hidden
          >
            <SectionIcon className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </span>

          <div className="min-w-0">
            {page.sectionLabel ? (
              <nav
                aria-label="Fil d'Ariane"
                className="flex min-w-0 items-center gap-1.5 text-[11px]"
              >
                <span className="hidden shrink-0 font-semibold uppercase tracking-[0.08em] text-slate-400 sm:inline">
                  {page.sectionLabel}
                </span>
                <ChevronRight
                  className="hidden h-3 w-3 shrink-0 text-slate-300 sm:inline"
                  aria-hidden
                />
              </nav>
            ) : null}
            <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[16px]">
              {page.title}
            </h1>
          </div>
        </div>

        {/* Actions & identité — groupes bien séparés plutôt qu'une seule pastille dense */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {pendingTotal > 0 ? (
            <Link
              href={pendingActionsHref(navBadges)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[12px] font-semibold text-amber-900 transition hover:bg-amber-100"
              title={`${pendingTotal} action${pendingTotal > 1 ? "s" : ""} à traiter`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} />
              <span className="tabular-nums sm:hidden">{pendingTotal}</span>
              <span className="hidden tabular-nums sm:inline">
                {pendingTotal} à traiter
              </span>
            </Link>
          ) : null}

          <EnablePushButton />

          <PlatformExpiryAlertsBell
            alerts={expiryAlerts}
            warningDays={warningDaysBeforeExpiry}
          />

          <TopbarDivider />

          <LiveClock
            inline
            showDate={false}
            className="hidden min-w-0 md:inline-flex xl:hidden"
          />
          <LiveClock
            inline
            showDate
            className="hidden min-w-0 xl:inline-flex"
          />

          <TopbarDivider />

          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition hover:bg-slate-50 lg:pr-2"
              title={displayName}
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white ring-2 ring-white">
                {initials}
              </span>
              <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
                <span className="max-w-[9rem] truncate text-[12.5px] font-semibold text-slate-900">
                  {displayName}
                </span>
                <span className="text-[10.5px] font-medium text-slate-500">
                  Super Admin
                </span>
              </span>
              <ChevronDown
                className={`hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform lg:block ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>

            {userMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5"
              >
                <div className="border-b border-slate-100 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-slate-900">
                      {displayName}
                    </p>
                    <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-emerald-700">
                      Super Admin
                    </span>
                  </div>
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
