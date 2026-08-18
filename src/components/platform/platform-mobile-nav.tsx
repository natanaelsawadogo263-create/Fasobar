"use client";

import { InstantLink } from "@/components/layout/instant-link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ComponentType } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  MonitorSmartphone,
  MoreHorizontal,
  Settings,
  Shield,
  Users,
  Wallet,
  X,
} from "lucide-react";

import {
  PLATFORM_NAV_ITEMS,
  PLATFORM_NAV_SECTIONS,
  badgeCountForItem,
  type PlatformNavBadges,
} from "@/lib/platform/navigation";

const PRIMARY_HREFS = [
  "/platform",
  "/platform/demandes-etablissement",
  "/platform/demandes-abonnement",
  "/platform/clients",
] as const;

const NAV_ICONS: Record<
  string,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  "/platform": LayoutDashboard,
  "/platform/demandes-etablissement": Building2,
  "/platform/demandes-abonnement": Wallet,
  "/platform/clients": Users,
  "/platform/abonnements": CreditCard,
  "/platform/machines": MonitorSmartphone,
  "/platform/super-admins": Shield,
  "/platform/parametres": Settings,
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/platform") return pathname === "/platform";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function shortLabel(label: string, item?: { shortLabel?: string }): string {
  if (item?.shortLabel) return item.shortLabel;
  return label;
}

type PlatformMobileNavProps = {
  badges: PlatformNavBadges;
};

export function PlatformMobileNav({ badges }: PlatformMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const primary = useMemo(
    () =>
      PRIMARY_HREFS.map(
        (href) => PLATFORM_NAV_ITEMS.find((item) => item.href === href)!,
      ).filter(Boolean),
    [],
  );

  const moreItems = useMemo(
    () =>
      PLATFORM_NAV_ITEMS.filter(
        (item) => !PRIMARY_HREFS.includes(item.href as (typeof PRIMARY_HREFS)[number]),
      ),
    [],
  );

  const moreActive = moreItems.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md md:hidden"
        aria-label="Navigation Super Admin"
      >
        <div className="mx-auto flex min-h-[3.75rem] max-w-lg items-stretch px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          {primary.map((item) => {
            const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
            const active = isActivePath(pathname, item.href);
            const badge = badgeCountForItem(item, badges);
            return (
              <InstantLink
                key={item.href}
                href={item.href}
                prefetch
                className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold ${
                  active ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                {active ? (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-emerald-500" />
                ) : null}
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  {badge > 0 ? (
                    <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">
                  {shortLabel(item.label, item)}
                </span>
              </InstantLink>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold ${
              moreActive || open ? "text-emerald-700" : "text-slate-500"
            }`}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={moreActive || open ? 2.4 : 2} />
            <span>Plus</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-3">
              <div className="min-w-0">
                <p id={titleId} className="text-[15px] font-bold text-slate-900">
                  Menu Super Admin
                </p>
                <p className="text-[12px] text-slate-500">Tous les écrans</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {PLATFORM_NAV_SECTIONS.map((section) => (
                <div key={section.id} className="mb-4 last:mb-0">
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {section.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {section.items.map((item) => {
                      const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
                      const active = isActivePath(pathname, item.href);
                      const badge = badgeCountForItem(item, badges);
                      return (
                        <InstantLink
                          key={item.href}
                          href={item.href}
                          prefetch
                          onClick={() => setOpen(false)}
                          className={`relative flex min-h-[4.5rem] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98] ${
                            active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 bg-slate-50/80 text-slate-700"
                          }`}
                        >
                          {badge > 0 ? (
                            <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                              {badge > 99 ? "99+" : badge}
                            </span>
                          ) : null}
                          <Icon className="h-5 w-5" strokeWidth={2.2} />
                          <span className="text-[11px] font-semibold leading-tight">
                            {shortLabel(item.label, item)}
                          </span>
                        </InstantLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
