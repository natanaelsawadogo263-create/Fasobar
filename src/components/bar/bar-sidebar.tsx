"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Clock3,
  GlassWater,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Timer,
  Truck,
  Wallet,
} from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { isHomeNavItem, type NavItem } from "@/lib/navigation/space-navigation";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/application/bar": LayoutDashboard,
  "/application/bar/commandes": GlassWater,
  "/application/bar/stock": Package,
  "/application/bar/approvisionnements": Truck,
  "/application/depenses": Wallet,
  "/application/bar/historique": Clock3,
  "/application/bar/session": Timer,
};

type BarSidebarProps = {
  navItems: NavItem[];
};

export function BarSidebar({ navItems }: BarSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[#051512] lg:w-[236px]">
      <div className="flex h-14 shrink-0 items-center px-4 lg:px-5">
        <FasoBarLogo size="sm" tone="dark" />
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4 pt-1"
        aria-label="Navigation Responsable Bar"
      >
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href] ?? Package;
          const isHome = isHomeNavItem(item);
          const isDashboard = item.href === "/application/bar";
          const isActive = isDashboard
            ? pathname === "/application/bar"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-white/30"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`flex items-center gap-3 rounded-xl transition ${
                isHome
                  ? isActive
                    ? "mb-1.5 bg-emerald-600 px-3 py-3 text-[14px] font-bold text-white shadow-md shadow-emerald-950/50"
                    : "mb-1.5 bg-emerald-500/15 px-3 py-3 text-[14px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25 hover:bg-emerald-500/25"
                  : isActive
                    ? "bg-emerald-600/80 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-900/40"
                    : "px-3 py-2.5 text-[13px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon
                className={`shrink-0 ${isHome ? "h-[18px] w-[18px]" : "h-4 w-4"}`}
                strokeWidth={isHome || isActive ? 2.35 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-4 py-4 lg:px-5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 text-[11px] leading-relaxed text-white/40">
            <p className="font-semibold text-white/70">FasoBar</p>
            <p>Responsable, chaque service compte.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
