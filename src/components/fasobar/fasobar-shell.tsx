"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { FasoBarSidebar } from "@/components/fasobar/fasobar-sidebar";
import { FasoBarTopbar } from "@/components/fasobar/fasobar-topbar";
import { MobileCaisseFilters } from "@/components/fasobar/mobile-caisse-filters";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

type FasoBarShellProps = {
  children: ReactNode;
};

export function FasoBarShell({ children }: FasoBarShellProps) {
  const pathname = usePathname();
  const isCaisse =
    pathname === "/application/caisse" || pathname.startsWith("/application/caisse?");
  const { collapsed, toggle } = useSidebarCollapsed("fasobar.caisse.sidebar.collapsed");

  return (
    <div className="fasobar-shell app-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[#f4f6f9]">
      <FasoBarTopbar />
      {isCaisse ? <MobileCaisseFilters /> : null}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 md:flex">
          <FasoBarSidebar collapsed={collapsed} onToggle={toggle} />
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
