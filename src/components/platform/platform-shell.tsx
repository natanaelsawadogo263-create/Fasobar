"use client";

import type { ReactNode } from "react";

import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformTopbar } from "@/components/platform/platform-topbar";
import type { PlatformExpiryAlert } from "@/lib/platform/expiry-alerts-types";
import { PLATFORM_NAV_ITEMS } from "@/lib/platform/navigation";

type PlatformShellProps = {
  adminEmail: string;
  adminName?: string | null;
  expiryAlerts?: PlatformExpiryAlert[];
  warningDaysBeforeExpiry?: number;
  children: ReactNode;
};

export function PlatformShell({
  adminEmail,
  adminName,
  expiryAlerts = [],
  warningDaysBeforeExpiry = 7,
  children,
}: PlatformShellProps) {
  return (
    <div className="platform-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f9]">
      <div className="hidden h-full shrink-0 md:flex">
        <PlatformSidebar navItems={PLATFORM_NAV_ITEMS} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformTopbar
          adminEmail={adminEmail}
          adminName={adminName}
          expiryAlerts={expiryAlerts}
          warningDaysBeforeExpiry={warningDaysBeforeExpiry}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
