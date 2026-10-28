"use client";

import type { ReactNode } from "react";

import { FasoBarCashierProvider } from "@/components/fasobar/fasobar-cashier-context";
import { FasoBarShell } from "@/components/fasobar/fasobar-shell";
import type { NavItem } from "@/lib/navigation/space-navigation";

type FasoBarCashierShellProps = {
  establishmentName: string;
  cashierName: string;
  establishmentId?: string;
  userId?: string;
  adminReturnHref?: string | null;
  navItems?: NavItem[];
  showDeliveryLink?: boolean;
  activityCode?: string | null;
  children: ReactNode;
};

export function FasoBarCashierShell({
  establishmentName,
  cashierName,
  establishmentId,
  userId,
  adminReturnHref = null,
  navItems = [],
  showDeliveryLink = false,
  activityCode = null,
  children,
}: FasoBarCashierShellProps) {
  return (
    <FasoBarCashierProvider
      establishmentName={establishmentName}
      cashierName={cashierName}
      establishmentId={establishmentId}
      userId={userId}
      adminReturnHref={adminReturnHref}
    >
      <FasoBarShell
        navItems={navItems}
        showDeliveryLink={showDeliveryLink}
        activityCode={activityCode}
      >
        {children}
      </FasoBarShell>
    </FasoBarCashierProvider>
  );
}
