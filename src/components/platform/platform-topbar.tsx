"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

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

function resolveDisplayName(adminName: string | null | undefined, adminEmail: string) {
  const trimmed = adminName?.trim() ?? "";
  if (!trimmed) return "Super Admin";
  if (trimmed.toLowerCase() === adminEmail.trim().toLowerCase()) {
    return "Super Admin";
  }
  if (trimmed.includes("@")) return "Super Admin";
  return trimmed;
}

export function PlatformTopbar({ adminEmail, adminName }: PlatformTopbarProps) {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);
  const displayName = resolveDisplayName(adminName, adminEmail);
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SA";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/90 bg-white px-4 lg:px-6">
      <div className="mr-auto min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
          Super Admin
        </p>
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
          {pageTitle}
        </h1>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden min-w-0 text-right leading-tight sm:block">
          <p className="truncate text-[12px] font-semibold text-slate-900">
            {displayName}
          </p>
          <p className="truncate text-[11px] text-slate-500">{adminEmail}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
          {initials}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
            title="Se déconnecter"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Déconnexion</span>
          </button>
        </form>
      </div>
    </header>
  );
}
