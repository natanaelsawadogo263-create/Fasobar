"use client";

import type { ReactNode } from "react";

import { SubscriptionExpiryBannerLoader } from "@/components/abonnement/subscription-expiry-banner-loader";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
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

const ADMIN_PRIMARY = [
  "/application/tableau-de-bord",
  "/application/produits",
  "/application/stock",
  "/application/ventes",
];

export function AdminShell({
  establishmentName,
  establishmentId,
  organizationId,
  adminName,
  navItems,
  canRenewSubscription = false,
  children,
}: AdminShellProps) {
  const { collapsed, toggle } = useSidebarCollapsed("fasobar.admin.sidebar.collapsed");

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
        />
        {organizationId ? (
          <SubscriptionExpiryBannerLoader
            organizationId={organizationId}
            canRenew={canRenewSubscription}
          />
        ) : null}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav items={navItems} primaryHrefs={ADMIN_PRIMARY} tone="admin" />
    </div>
  );
}
