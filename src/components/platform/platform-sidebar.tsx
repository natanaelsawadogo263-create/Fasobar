"use client";

import { InstantLink } from "@/components/layout/instant-link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import {
  PLATFORM_NAV_SECTIONS,
  badgeCountForItem,
  totalPendingActions,
  type PlatformNavBadges,
  type PlatformNavItem,
  type PlatformNavSection,
} from "@/lib/platform/navigation";

export const PLATFORM_NAV_ICONS: Record<
  string,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  "/platform": LayoutDashboard,
  "/platform/demandes-etablissement": Building2,
  "/platform/demandes-abonnement": Wallet,
  "/platform/clients": Users,
  "/platform/abonnements": CreditCard,
  "/platform/parametres": Settings,
};

type PlatformSidebarProps = {
  badges: PlatformNavBadges;
};

function NavBadge({ count, urgent = false }: { count: number; urgent?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
        urgent
          ? "bg-amber-400 text-amber-950"
          : "bg-white/10 text-slate-200"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({
  item,
  badges,
  pathname,
  urgentSection = false,
}: {
  item: PlatformNavItem;
  badges: PlatformNavBadges;
  pathname: string;
  urgentSection?: boolean;
}) {
  const Icon = PLATFORM_NAV_ICONS[item.href] ?? LayoutDashboard;
  const isActive =
    item.href === "/platform"
      ? pathname === "/platform"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const badge = badgeCountForItem(item, badges);

  if (!item.enabled) {
    return (
      <span
        title="Bientôt disponible"
        className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-600"
      >
        <Icon className="h-[15px] w-[15px] shrink-0 opacity-40" />
        <span className="truncate">{item.label}</span>
      </span>
    );
  }

  return (
    <InstantLink
      href={item.href}
      prefetch
      className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
        isActive
          ? "bg-white/[0.09] font-semibold text-white ring-1 ring-white/10"
          : "font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
      }`}
    >
      {isActive ? (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-emerald-400" />
      ) : null}
      <Icon
        className={`h-[15px] w-[15px] shrink-0 ${
          isActive
            ? "text-emerald-400"
            : "text-slate-500 group-hover:text-slate-300"
        }`}
        strokeWidth={isActive ? 2.3 : 2}
      />
      <span className="min-w-0 truncate">{item.label}</span>
      <NavBadge count={badge} urgent={urgentSection && badge > 0} />
    </InstantLink>
  );
}

function NavSection({
  section,
  badges,
  pathname,
  urgent = false,
}: {
  section: PlatformNavSection;
  badges: PlatformNavBadges;
  pathname: string;
  urgent?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {section.label}
      </p>
      <div className="flex flex-col gap-0.5">
        {section.items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            badges={badges}
            pathname={pathname}
            urgentSection={urgent}
          />
        ))}
      </div>
    </div>
  );
}

export function PlatformSidebar({ badges }: PlatformSidebarProps) {
  const pathname = usePathname();
  const pendingTotal = totalPendingActions(badges);

  const pilotage = PLATFORM_NAV_SECTIONS.find((s) => s.id === "pilotage")!;
  const queue = PLATFORM_NAV_SECTIONS.find((s) => s.id === "queue")!;
  const portfolio = PLATFORM_NAV_SECTIONS.find((s) => s.id === "portfolio")!;
  const platform = PLATFORM_NAV_SECTIONS.find((s) => s.id === "platform")!;

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0b1220] text-slate-300 lg:w-[252px]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
        <FasoBarLogo size="sm" tone="dark" />
        <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          Super Admin
        </span>
      </div>

      {pendingTotal > 0 ? (
        <div className="shrink-0 border-b border-amber-500/15 bg-amber-500/[0.07] px-3 py-2.5">
          <InstantLink
            href="/platform/demandes-etablissement"
            prefetch
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-amber-500/10"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
                Priorité
              </p>
              <p className="truncate text-[12px] font-medium text-amber-50">
                {pendingTotal} action{pendingTotal > 1 ? "s" : ""} en attente
              </p>
            </div>
            <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-950">
              {pendingTotal > 99 ? "99+" : pendingTotal}
            </span>
          </InstantLink>
        </div>
      ) : null}

      <nav
        className="app-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3"
        aria-label="Navigation Super Admin"
      >
        <NavSection section={pilotage} badges={badges} pathname={pathname} />
        <NavSection section={queue} badges={badges} pathname={pathname} urgent />
        <div className="h-px bg-white/[0.06]" />
        <NavSection section={portfolio} badges={badges} pathname={pathname} />
        <NavSection section={platform} badges={badges} pathname={pathname} />
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
          FasoBar Platform
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">© {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
