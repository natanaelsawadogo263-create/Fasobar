"use client";

import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import type { NavItem } from "@/lib/navigation/space-navigation";

type AdminShellProps = {
  establishmentName: string;
  organizationName: string;
  adminName: string;
  navItems: NavItem[];
  notificationCount?: number;
  children: ReactNode;
};

export function AdminShell({
  establishmentName,
  adminName,
  navItems,
  notificationCount = 0,
  children,
}: AdminShellProps) {
  return (
    <div className="admin-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f9]">
      <div className="hidden h-full shrink-0 md:flex">
        <AdminSidebar navItems={navItems} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar
          establishmentName={establishmentName}
          adminName={adminName}
          notificationCount={notificationCount}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
