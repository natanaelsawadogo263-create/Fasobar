"use client";

import type { ReactNode } from "react";

import { SubscriptionExpiryBannerLoader } from "@/components/abonnement/subscription-expiry-banner-loader";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { isRetailShopOps } from "@/lib/activity/ops-model";
import type { NavItem } from "@/lib/navigation/space-navigation";

type AdminShellProps = {
  establishmentName: string;
  organizationName: string;
  establishmentId: string;
  organizationId?: string;
  adminName: string;
  navItems: NavItem[];
  canRenewSubscription?: boolean;
  activityCode?: string | null;
  children: ReactNode;
  roleLabel?: string;
  roleSubtitle?: string;
  showNotifications?: boolean;
  primaryHrefs?: string[];
  showSubscriptionBanner?: boolean;
};

const ADMIN_PRIMARY = [
  "/application/tableau-de-bord",
  "/application/produits",
  "/application/stock",
  "/application/ventes",
];

const HARDWARE_ADMIN_PRIMARY = [
  "/application/tableau-de-bord",
  "/application/produits",
  "/application/stock",
  "/application/ventes",
];

const GAS_STATION_ADMIN_PRIMARY = [
  "/application/station",
  "/application/station/employes",
  "/application/station/sessions",
  "/application/station/bilans",
];

export function AdminShell({
  establishmentName,
  establishmentId,
  organizationId,
  adminName,
  navItems,
  canRenewSubscription = false,
  activityCode = null,
  children,
  roleLabel = "Admin",
  roleSubtitle = "Administrateur",
  showNotifications = true,
  primaryHrefs,
  showSubscriptionBanner = true,
}: AdminShellProps) {
  const { collapsed, toggle } = useSidebarCollapsed("fasobar.admin.sidebar.collapsed");
  const mobilePrimary =
    primaryHrefs ??
    (activityCode === "gas_station"
      ? GAS_STATION_ADMIN_PRIMARY
      : isRetailShopOps(activityCode)
        ? HARDWARE_ADMIN_PRIMARY
        : ADMIN_PRIMARY);

  return (
    <div className="admin-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f9]">
      <div className="hidden h-full shrink-0 md:flex">
        <AdminSidebar navItems={navItems} collapsed={collapsed} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar
          establishmentName={establishmentName}
          establishmentId={establishmentId}
          adminName={adminName}
          sidebarCollapsed={collapsed}
          onToggleSidebar={toggle}
          roleLabel={roleLabel}
          roleSubtitle={roleSubtitle}
          showNotifications={showNotifications}
        />
        {organizationId && showSubscriptionBanner ? (
          <SubscriptionExpiryBannerLoader
            organizationId={organizationId}
            canRenew={canRenewSubscription}
          />
        ) : null}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav
        items={navItems}
        primaryHrefs={mobilePrimary}
        tone="admin"
      />
    </div>
  );
}
