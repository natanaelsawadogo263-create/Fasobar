"use client";

import { InstantLink } from "@/components/layout/instant-link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { LiveClock } from "@/components/ui/live-clock";
import { type UserSpace } from "@/lib/auth/roles";
import { displaySpaceLabel } from "@/lib/activity/profile";
import { isHomeNavItem, type NavItem } from "@/lib/navigation/space-navigation";

type SpaceSidebarProps = {
  space: UserSpace;
  establishmentName: string;
  organizationName: string;
  navItems: NavItem[];
  activityCode?: string | null;
};

export function SpaceSidebar({
  space,
  establishmentName,
  organizationName,
  navItems,
  activityCode = null,
}: SpaceSidebarProps) {
  const pathname = usePathname();
  const spaceLabel = displaySpaceLabel(space, activityCode);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-emerald-100 bg-white">
      <div className="shrink-0 border-b border-emerald-50 px-5 py-4">
        <FasoBarLogo size="sm" />
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          {spaceLabel}
        </p>
        <p className="mt-2 truncate text-sm font-medium text-slate-900">{establishmentName}</p>
        <p className="truncate text-xs text-slate-500">{organizationName}</p>
      </div>

      <nav
        className="app-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3"
        aria-label="Navigation principale"
      >
        {navItems.map((item) => {
          const isHome =
            isHomeNavItem(item) ||
            (space === "bar_manager" && item.href === "/application/stock");
          const isActive =
            item.href === "/application/caisse"
              ? pathname === "/application/caisse" ||
                pathname.startsWith("/application/caisse?")
              : item.href === "/application/station/pompiste"
                ? pathname === "/application/station/pompiste"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
              >
                {item.label}
              </span>
            );
          }

          return (
            <InstantLink
              key={item.href}
              href={item.href}
              prefetch
              className={`flex items-center gap-3 rounded-xl transition ${
                isHome
                  ? isActive
                    ? "mb-1.5 bg-emerald-600 px-3 py-3 text-[15px] font-bold text-white shadow-sm"
                    : "mb-1.5 bg-emerald-50 px-3 py-3 text-[15px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                  : isActive
                    ? "bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800"
                    : "px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </InstantLink>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-emerald-50 px-4 py-3">
        <LiveClock className="w-full justify-start" />
        <SignOutButton />
      </div>
    </aside>
  );
}
