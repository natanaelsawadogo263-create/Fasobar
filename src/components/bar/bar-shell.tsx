"use client";

import type { ReactNode } from "react";

import { BarSidebar } from "@/components/bar/bar-sidebar";
import { BarTopbar } from "@/components/bar/bar-topbar";
import type { NavItem } from "@/lib/navigation/space-navigation";

type BarShellProps = {
  establishmentName: string;
  navItems: NavItem[];
  children: ReactNode;
  managerName?: string;
  hasOwnSession?: boolean;
  sessionOpenedAt?: string;
  openSessionHolderName?: string | null;
};

export function BarShell({
  establishmentName,
  navItems,
  children,
  managerName,
  hasOwnSession,
  sessionOpenedAt,
  openSessionHolderName,
}: BarShellProps) {
  return (
    <div className="bar-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f8]">
      <div className="flex h-full shrink-0">
        <BarSidebar navItems={navItems} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BarTopbar
          establishmentName={establishmentName}
          managerName={managerName}
          hasOwnSession={hasOwnSession}
          sessionOpenedAt={sessionOpenedAt}
          openSessionHolderName={openSessionHolderName}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
