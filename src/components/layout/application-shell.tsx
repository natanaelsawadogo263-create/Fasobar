"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { BarShell } from "@/components/bar/bar-shell";
import { FasoBarCashierShell } from "@/components/fasobar/fasobar-cashier-shell";
import { SpaceShell } from "@/components/layout/space-shell";
import { EstablishmentLiveSync } from "@/components/ops/establishment-live-sync";
import type { UserSpace } from "@/lib/auth/roles";
import type { NavItem } from "@/lib/navigation/space-navigation";

type ApplicationShellProps = {
  space: UserSpace;
  establishmentId: string;
  establishmentName: string;
  organizationName: string;
  navItems: NavItem[];
  children: ReactNode;
  cashierName?: string;
  hasSession?: boolean;
  sessionOpenedAt?: string;
  openSessionHolderName?: string | null;
  openOrdersCount?: number;
  readyToPayCount?: number;
  notificationCount?: number;
};

function isFasoBarCashierRoute(pathname: string): boolean {
  return (
    pathname === "/application/caisse" ||
    pathname.startsWith("/application/caisse/") ||
    pathname.startsWith("/application/encaissement/") ||
    pathname === "/application/commandes-ouvertes" ||
    pathname.startsWith("/application/commandes-ouvertes") ||
    pathname === "/application/cuisine" ||
    pathname.startsWith("/application/cuisine")
  );
}

export function ApplicationShell({
  space,
  establishmentId,
  establishmentName,
  organizationName,
  navItems,
  children,
  cashierName = "",
  hasSession = false,
  sessionOpenedAt,
  openSessionHolderName = null,
  openOrdersCount = 0,
  readyToPayCount = 0,
  notificationCount = 0,
}: ApplicationShellProps) {
  const pathname = usePathname();

  const liveSync = <EstablishmentLiveSync establishmentId={establishmentId} />;

  if (space === "admin") {
    return (
      <>
        {liveSync}
        <AdminShell
          establishmentName={establishmentName}
          organizationName={organizationName}
          adminName={cashierName || "Admin"}
          navItems={navItems}
          notificationCount={notificationCount}
        >
          {children}
        </AdminShell>
      </>
    );
  }

  if (space === "cashier_kitchen" && isFasoBarCashierRoute(pathname)) {
    return (
      <>
        {liveSync}
        <FasoBarCashierShell
          establishmentName={establishmentName}
          cashierName={cashierName}
          hasSession={hasSession}
          sessionOpenedAt={sessionOpenedAt}
          openOrdersCount={openOrdersCount}
          readyToPayCount={readyToPayCount}
        >
          {children}
        </FasoBarCashierShell>
      </>
    );
  }

  if (space === "bar_manager") {
    return (
      <>
        {liveSync}
        <BarShell
          establishmentName={establishmentName}
          navItems={navItems}
          managerName={cashierName || "Responsable Bar"}
          hasOwnSession={hasSession}
          sessionOpenedAt={sessionOpenedAt}
          openSessionHolderName={openSessionHolderName}
        >
          {children}
        </BarShell>
      </>
    );
  }

  return (
    <>
      {liveSync}
      <SpaceShell
        space={space}
        establishmentName={establishmentName}
        organizationName={organizationName}
        navItems={navItems}
      >
        {children}
      </SpaceShell>
    </>
  );
}
