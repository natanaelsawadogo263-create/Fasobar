"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  MonitorSmartphone,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { isHomeNavItem } from "@/lib/navigation/space-navigation";
import type { PlatformNavItem } from "@/lib/platform/navigation";

const NAV_ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/platform": LayoutDashboard,
  "/platform/clients": Users,
  "/platform/demandes-abonnement": FileText,
  "/platform/abonnements": CreditCard,
  "/platform/machines": MonitorSmartphone,
  "/platform/super-admins": Shield,
  "/platform/parametres": Settings,
};

type PlatformSidebarProps = {
  navItems: PlatformNavItem[];
};

export function PlatformSidebar({ navItems }: PlatformSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-white/5 bg-[#0a101c] text-slate-300 lg:w-[260px]">
      <div className="flex shrink-0 items-center gap-3 px-5 py-5">
        <FasoBarLogo size="sm" tone="dark" />
      </div>

      <div className="px-5 pb-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90">
            Control plane
          </p>
          <p className="mt-0.5 text-[12px] text-slate-400">
            Super Admin FasoBar
          </p>
        </div>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3"
        aria-label="Navigation plateforme"
      >
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
          const isHome = isHomeNavItem(item);
          const isActive =
            item.href === "/platform"
              ? pathname === "/platform"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                title="Bientôt disponible"
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-slate-600"
              >
                <Icon className="h-4 w-4 shrink-0 opacity-40" />
                <span className="truncate">{item.label}</span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl transition ${
                isHome
                  ? isActive
                    ? "mb-1.5 bg-emerald-600 px-3 py-3 text-[14px] font-bold text-white shadow-md shadow-emerald-950/40"
                    : "mb-1.5 bg-emerald-500/15 px-3 py-3 text-[14px] font-semibold text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/25"
                  : isActive
                    ? "bg-emerald-500/10 px-3 py-2.5 text-[13px] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                    : "px-3 py-2.5 text-[13px] text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              {isActive && !isHome ? (
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-emerald-400" />
              ) : null}
              <Icon
                className={`shrink-0 transition ${
                  isHome
                    ? `h-[18px] w-[18px] ${isActive ? "text-white" : "text-emerald-400"}`
                    : `h-4 w-4 ${
                        isActive
                          ? "text-emerald-400"
                          : "text-slate-500 group-hover:text-slate-300"
                      }`
                }`}
                strokeWidth={isHome ? 2.4 : 2}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
        <p className="font-medium text-slate-400">FasoBar Platform</p>
        <p>Gouvernance SaaS · © {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
