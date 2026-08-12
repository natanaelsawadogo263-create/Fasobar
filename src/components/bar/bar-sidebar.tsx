"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Clock3,
  GlassWater,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Timer,
  Truck,
  Wallet,
} from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
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
  const { collapsed, toggle } = useSidebarCollapsed("fasobar.bar.sidebar.collapsed");

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-[#051512] transition-[width] duration-200 ease-out ${
        collapsed ? "w-[68px]" : "w-[220px] lg:w-[236px]"
      }`}
    >
      <div
        className={`flex h-12 shrink-0 items-center border-b border-white/10 ${
          collapsed ? "justify-center px-1.5" : "justify-between gap-2 px-3 lg:px-4"
        }`}
      >
        {collapsed ? null : <FasoBarLogo size="sm" tone="dark" />}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          aria-expanded={!collapsed}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-white/80 transition hover:bg-white/[0.12] hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav
        className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-4 pt-1.5 ${
          collapsed ? "px-1.5" : "px-3"
        }`}
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
                title={item.label}
                className={`flex items-center rounded-lg text-[13px] text-white/30 ${
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {collapsed ? null : item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-xl transition ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3"
              } ${
                isHome
                  ? isActive
                    ? collapsed
                      ? "mb-1 bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                      : "mb-1.5 bg-emerald-600 px-3 py-3 text-[14px] font-bold text-white shadow-md shadow-emerald-950/50"
                    : collapsed
                      ? "mb-1 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25 hover:bg-emerald-500/25"
                      : "mb-1.5 bg-emerald-500/15 px-3 py-3 text-[14px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25 hover:bg-emerald-500/25"
                  : isActive
                    ? collapsed
                      ? "bg-emerald-600/80 text-white shadow-sm shadow-emerald-900/40"
                      : "bg-emerald-600/80 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-900/40"
                    : collapsed
                      ? "text-white/55 hover:bg-white/[0.06] hover:text-white"
                      : "px-3 py-2.5 text-[13px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon
                className={`shrink-0 ${isHome ? "h-[18px] w-[18px]" : "h-4 w-4"}`}
                strokeWidth={isHome || isActive ? 2.35 : 2}
              />
              {collapsed ? null : item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className={`shrink-0 border-t border-white/10 ${
          collapsed ? "hidden" : "px-4 py-4 lg:px-5"
        }`}
      >
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
