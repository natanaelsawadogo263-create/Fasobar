"use client";

import type { ReactNode } from "react";

import { FasoBarCashierProvider } from "@/components/fasobar/fasobar-cashier-context";
import { FasoBarShell } from "@/components/fasobar/fasobar-shell";

type FasoBarCashierShellProps = {
  establishmentName: string;
  cashierName: string;
  hasSession: boolean;
  sessionOpenedAt?: string;
  openOrdersCount: number;
  readyToPayCount: number;
  children: ReactNode;
};

export function FasoBarCashierShell({
  establishmentName,
  cashierName,
  hasSession,
  sessionOpenedAt,
  openOrdersCount,
  readyToPayCount,
  children,
}: FasoBarCashierShellProps) {
  return (
    <FasoBarCashierProvider
      establishmentName={establishmentName}
      cashierName={cashierName}
      hasSession={hasSession}
      sessionOpenedAt={sessionOpenedAt}
      openOrdersCount={openOrdersCount}
      readyToPayCount={readyToPayCount}
    >
      <FasoBarShell>{children}</FasoBarShell>
    </FasoBarCashierProvider>
  );
}
