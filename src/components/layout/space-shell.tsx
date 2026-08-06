"use client";

import type { ReactNode } from "react";

import { SpaceSidebar } from "@/components/layout/space-sidebar";
import type { UserSpace } from "@/lib/auth/roles";
import type { NavItem } from "@/lib/navigation/space-navigation";

type SpaceShellProps = {
  space: UserSpace;
  establishmentName: string;
  organizationName: string;
  navItems: NavItem[];
  children: ReactNode;
  fullBleed?: boolean;
};

export function SpaceShell({
  space,
  establishmentName,
  organizationName,
  navItems,
  children,
  fullBleed = false,
}: SpaceShellProps) {
  if (fullBleed) {
    return <>{children}</>;
  }

  return (
    <div className="space-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-slate-50">
      <div className="hidden h-full w-64 shrink-0 md:block lg:w-72">
        <SpaceSidebar
          space={space}
          establishmentName={establishmentName}
          organizationName={organizationName}
          navItems={navItems}
        />
      </div>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3 md:px-5 md:py-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
