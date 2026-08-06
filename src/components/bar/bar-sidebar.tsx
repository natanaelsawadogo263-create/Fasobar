"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Clock3,
  GlassWater,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Timer,
  Truck,
  Wine,
} from "lucide-react";

import type { NavItem } from "@/lib/navigation/space-navigation";

const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/application/bar": LayoutDashboard,
  "/application/bar/commandes": GlassWater,
  "/application/bar/stock": Package,
  "/application/bar/approvisionnements": Truck,
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
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4 lg:px-5">
        <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/25">
          <Wine className="h-4 w-4" strokeWidth={2.25} />
          <GlassWater
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-emerald-300"
            strokeWidth={2.25}
          />
        </span>
        <span className="text-[19px] font-bold tracking-tight text-white">
          Faso<span className="text-emerald-400">Bar</span>
        </span>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4 pt-1"
        aria-label="Navigation Responsable Bar"
      >
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href] ?? Package;
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${
                isActive
                  ? "bg-emerald-600 font-semibold text-white shadow-sm shadow-emerald-900/40"
                  : "font-medium text-white/55 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
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
