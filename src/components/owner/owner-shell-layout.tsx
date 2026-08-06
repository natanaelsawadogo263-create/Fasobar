"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarNav } from "@/components/owner/sidebar-nav";

type OwnerShellLayoutProps = {
  establishmentName: string;
  organizationName: string;
  children: ReactNode;
};

function isPosRoute(pathname: string): boolean {
  return (
    pathname === "/application/caisse" ||
    pathname.startsWith("/application/caisse/")
  );
}

export function OwnerShellLayout({
  establishmentName,
  organizationName,
  children,
}: OwnerShellLayoutProps) {
  const pathname = usePathname();

  if (isPosRoute(pathname)) {
    return (
      <div className="h-dvh w-screen overflow-hidden bg-[#eef0f3]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <div className="hidden w-72 shrink-0 md:block">
          <SidebarNav
            establishmentName={establishmentName}
            organizationName={organizationName}
          />
        </div>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
