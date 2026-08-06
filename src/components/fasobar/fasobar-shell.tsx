"use client";

import type { ReactNode } from "react";

import { FasoBarSidebar } from "@/components/fasobar/fasobar-sidebar";
import { FasoBarTopbar } from "@/components/fasobar/fasobar-topbar";

type FasoBarShellProps = {
  children: ReactNode;
};

export function FasoBarShell({ children }: FasoBarShellProps) {
  return (
    <div className="fasobar-shell app-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[#f4f6f9]">
      <FasoBarTopbar />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <FasoBarSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
