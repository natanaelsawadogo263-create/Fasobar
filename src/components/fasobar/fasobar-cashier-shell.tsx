"use client";

import type { ReactNode } from "react";

import { FasoBarCashierProvider } from "@/components/fasobar/fasobar-cashier-context";
import { FasoBarShell } from "@/components/fasobar/fasobar-shell";

type FasoBarCashierShellProps = {
  establishmentName: string;
  cashierName: string;
  establishmentId?: string;
  userId?: string;
  children: ReactNode;
};

export function FasoBarCashierShell({
  establishmentName,
  cashierName,
  establishmentId,
  userId,
  children,
}: FasoBarCashierShellProps) {
  return (
    <FasoBarCashierProvider
      establishmentName={establishmentName}
      cashierName={cashierName}
      establishmentId={establishmentId}
      userId={userId}
    >
      <FasoBarShell>{children}</FasoBarShell>
    </FasoBarCashierProvider>
  );
}
