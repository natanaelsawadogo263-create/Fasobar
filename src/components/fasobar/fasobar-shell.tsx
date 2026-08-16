"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { FasoBarSidebar } from "@/components/fasobar/fasobar-sidebar";
import { FasoBarTopbar } from "@/components/fasobar/fasobar-topbar";
import { MobileCaisseFilters } from "@/components/fasobar/mobile-caisse-filters";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import type { NavItem } from "@/lib/navigation/space-navigation";

type FasoBarShellProps = {
  children: ReactNode;
  navItems?: NavItem[];
};

const CASHIER_PRIMARY = [
  "/application/caisse",
  "/application/commandes-ouvertes",
  "/application/cuisine",
  "/application/caisse/session",
];

export function FasoBarShell({ children, navItems = [] }: FasoBarShellProps) {
  const pathname = usePathname();
  const isCaisse =
    pathname === "/application/caisse" || pathname.startsWith("/application/caisse?");
  const { collapsed, toggle } = useSidebarCollapsed("fasobar.caisse.sidebar.collapsed");
  const showMobileNav = !isCaisse && navItems.some((item) => item.enabled);

  return (
    <div className="fasobar-shell app-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[#f4f6f9]">
      <FasoBarTopbar />
      {isCaisse ? <MobileCaisseFilters /> : null}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 md:flex">
          <FasoBarSidebar collapsed={collapsed} onToggle={toggle} />
        </div>
        <main
          className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            showMobileNav
              ? "pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0"
              : ""
          }`}
        >
          {children}
        </main>
      </div>
      {showMobileNav ? (
        <MobileNav items={navItems} primaryHrefs={CASHIER_PRIMARY} />
      ) : null}
    </div>
  );
}
