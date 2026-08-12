"use client";

import type { ReactNode } from "react";

import { SubscriptionExpiryBannerLoader } from "@/components/abonnement/subscription-expiry-banner-loader";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import type { NavItem } from "@/lib/navigation/space-navigation";

type AdminShellProps = {
  establishmentName: string;
  organizationName: string;
  establishmentId: string;
  organizationId?: string;
  adminName: string;
  navItems: NavItem[];
  canRenewSubscription?: boolean;
  children: ReactNode;
};

export function AdminShell({
  establishmentName,
  establishmentId,
  organizationId,
  adminName,
  navItems,
  canRenewSubscription = false,
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
          establishmentId={establishmentId}
          adminName={adminName}
        />
        {organizationId ? (
          <SubscriptionExpiryBannerLoader
            organizationId={organizationId}
            canRenew={canRenewSubscription}
          />
        ) : null}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
