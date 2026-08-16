"use client";

import type { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SpaceSidebar } from "@/components/layout/space-sidebar";
import type { UserSpace } from "@/lib/auth/roles";
import type { NavItem } from "@/lib/navigation/space-navigation";
import { isRetailShopOps } from "@/lib/activity/ops-model";

type SpaceShellProps = {
  space: UserSpace;
  establishmentName: string;
  organizationName: string;
  navItems: NavItem[];
  children: ReactNode;
  fullBleed?: boolean;
  activityCode?: string | null;
};

export function SpaceShell({
  space,
  establishmentName,
  organizationName,
  navItems,
  children,
  fullBleed = false,
  activityCode = null,
}: SpaceShellProps) {
  if (fullBleed) {
    return <>{children}</>;
  }

  const hardwareStockManager = space === "bar_manager" && isRetailShopOps(activityCode);
  const primaryHrefs = hardwareStockManager
    ? [
        "/application/stock",
        "/application/produits",
        "/application/approvisionnements",
        "/application/depenses",
      ]
    : navItems.filter((item) => item.enabled).slice(0, 4).map((item) => item.href);

  return (
    <div className="space-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-slate-50">
      <div className="hidden h-full w-64 shrink-0 md:block lg:w-72">
        <SpaceSidebar
          space={space}
          establishmentName={establishmentName}
          organizationName={organizationName}
          navItems={navItems}
          activityCode={activityCode}
        />
      </div>
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3 pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:px-5 md:py-4 md:pb-4">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>
      <MobileNav items={navItems} primaryHrefs={primaryHrefs} />
    </div>
  );
}
