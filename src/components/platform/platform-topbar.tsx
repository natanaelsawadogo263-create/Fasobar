"use client";

import { usePathname } from "next/navigation";
import { LogOut, Shield } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { PLATFORM_NAV_ITEMS } from "@/lib/platform/navigation";

type PlatformTopbarProps = {
  adminEmail: string;
  adminName?: string | null;
};

function resolvePageTitle(pathname: string): string {
  if (pathname === "/platform") return "Tableau de bord";

  const match = PLATFORM_NAV_ITEMS.find(
    (item) => item.href !== "/platform" && pathname.startsWith(item.href),
  );

  return match?.label ?? "Espace plateforme";
}

export function PlatformTopbar({ adminEmail, adminName }: PlatformTopbarProps) {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);
  const displayName = adminName?.trim() || "Super Admin";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SA";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200/90 bg-white px-3 lg:px-5">
      <div className="mr-auto flex min-w-0 items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
          <Shield className="h-3.5 w-3.5" />
          Espace plateforme
        </span>
        <h1 className="hidden truncate text-[14px] font-semibold text-slate-900 sm:block">
          {pageTitle}
        </h1>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="hidden min-w-0 text-right leading-tight md:block">
          <p className="truncate text-[12px] font-semibold text-slate-900">{displayName}</p>
          <p className="truncate text-[11px] text-slate-500">{adminEmail}</p>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
          {initials}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
            title="Se déconnecter"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </form>
      </div>
    </header>
  );
}
