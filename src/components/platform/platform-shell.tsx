"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { PrefetchRoutes } from "@/components/layout/prefetch-routes";
import { PlatformMobileNav } from "@/components/platform/platform-mobile-nav";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformTopbar } from "@/components/platform/platform-topbar";
import { unlockNotificationAudio } from "@/lib/admin/notification-chime";
import type { PlatformExpiryAlert } from "@/lib/platform/expiry-alerts-types";
import {
  PLATFORM_NAV_ITEMS,
  type PlatformNavBadges,
} from "@/lib/platform/navigation";

type PlatformShellProps = {
  adminEmail: string;
  adminName?: string | null;
  expiryAlerts?: PlatformExpiryAlert[];
  warningDaysBeforeExpiry?: number;
  navBadges: PlatformNavBadges;
  children: ReactNode;
};

export function PlatformShell({
  adminEmail,
  adminName,
  expiryAlerts = [],
  warningDaysBeforeExpiry = 7,
  navBadges,
  children,
}: PlatformShellProps) {
  const prefetchHrefs = PLATFORM_NAV_ITEMS.filter((item) => item.enabled).map(
    (item) => item.href,
  );

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <div className="platform-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f9]">
      <PrefetchRoutes hrefs={prefetchHrefs} />

      <div className="hidden h-full shrink-0 md:flex">
        <PlatformSidebar badges={navBadges} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformTopbar
          adminEmail={adminEmail}
          adminName={adminName}
          expiryAlerts={expiryAlerts}
          warningDaysBeforeExpiry={warningDaysBeforeExpiry}
          navBadges={navBadges}
        />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <PlatformMobileNav badges={navBadges} />
    </div>
  );
}
