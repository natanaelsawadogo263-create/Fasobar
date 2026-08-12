"use client";

import { PrefetchRoutes } from "@/components/layout/prefetch-routes";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { EstablishmentLiveSync } from "@/components/ops/establishment-live-sync";
import type { UserSpace } from "@/lib/auth/roles";
import type { NavItem } from "@/lib/navigation/space-navigation";
import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { BarShell } from "@/components/bar/bar-shell";
import { CashierSecondaryShell } from "@/components/cashier/cashier-secondary-shell";
import { FasoBarCashierShell } from "@/components/fasobar/fasobar-cashier-shell";
import { SpaceShell } from "@/components/layout/space-shell";
import { ToastProvider } from "@/components/ui/toast";

type ApplicationShellProps = {
  space: UserSpace;
  establishmentId: string;
  establishmentName: string;
  organizationName: string;
  organizationId?: string;
  userId?: string;
  navItems: NavItem[];
  children: ReactNode;
  cashierName?: string;
  canRenewSubscription?: boolean;
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

function isOrderFocusRoute(pathname: string): boolean {
  return /^\/application\/commandes\/[^/]+/.test(pathname);
}

function isCashierSecondaryRoute(pathname: string): boolean {
  return (
    pathname === "/application/depenses" ||
    pathname.startsWith("/application/depenses/") ||
    pathname === "/application/approvisionnements" ||
    pathname.startsWith("/application/approvisionnements/")
  );
}

export function ApplicationShell({
  space,
  establishmentId,
  establishmentName,
  organizationName,
  organizationId = "",
  userId = "",
  navItems,
  children,
  cashierName = "",
  canRenewSubscription = false,
}: ApplicationShellProps) {
  const pathname = usePathname();
  const prefetch = (
    <PrefetchRoutes hrefs={navItems.filter((item) => item.enabled).map((item) => item.href)} />
  );
  const liveSync = <EstablishmentLiveSync establishmentId={establishmentId} />;
  const progress = (
    <Suspense fallback={null}>
      <NavigationProgress />
    </Suspense>
  );

  if (space === "admin") {
    return (
      <ToastProvider>
        {progress}
        {prefetch}
        {liveSync}
        <AdminShell
          establishmentId={establishmentId}
          establishmentName={establishmentName}
          organizationName={organizationName}
          organizationId={organizationId}
          adminName={cashierName || "Admin"}
          navItems={navItems}
          canRenewSubscription={canRenewSubscription}
        >
          {children}
        </AdminShell>
      </ToastProvider>
    );
  }

  if (space === "cashier_kitchen" && isOrderFocusRoute(pathname)) {
    return (
      <>
        {progress}
        {prefetch}
        {liveSync}
        <div className="app-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-slate-50">
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2 md:px-4 md:py-3">
            {children}
          </main>
        </div>
      </>
    );
  }

  if (space === "cashier_kitchen" && isCashierSecondaryRoute(pathname)) {
    return (
      <>
        {progress}
        {prefetch}
        {liveSync}
        <CashierSecondaryShell>{children}</CashierSecondaryShell>
      </>
    );
  }

  if (space === "cashier_kitchen" && isFasoBarCashierRoute(pathname)) {
    return (
      <>
        {progress}
        {prefetch}
        {liveSync}
        <FasoBarCashierShell
          establishmentId={establishmentId}
          userId={userId}
          establishmentName={establishmentName}
          cashierName={cashierName}
        >
          {children}
        </FasoBarCashierShell>
      </>
    );
  }

  if (space === "bar_manager") {
    return (
      <>
        {progress}
        {prefetch}
        {liveSync}
        <BarShell
          establishmentId={establishmentId}
          userId={userId}
          establishmentName={establishmentName}
          navItems={navItems}
          managerName={cashierName || "Responsable Bar"}
        >
          {children}
        </BarShell>
      </>
    );
  }

  return (
    <>
      {progress}
      {prefetch}
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
