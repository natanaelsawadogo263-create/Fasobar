"use client";

import { InstantLink } from "@/components/layout/instant-link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Timer,
  Truck,
  Users,
  BarChart3,
  Wallet,
  Landmark,
  Clock3,
  Fuel,
} from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { isHomeNavItem, type NavItem } from "@/lib/navigation/space-navigation";

const NAV_ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/application/tableau-de-bord": LayoutDashboard,
  "/application/produits": Package,
  "/application/stock": Boxes,
  "/application/approvisionnements": Truck,
  "/application/inventaires": ClipboardList,
  "/application/depenses": Wallet,
  "/application/ventes": ShoppingBag,
  "/application/commandes": ClipboardList,
  "/application/caisses": Landmark,
  "/application/sessions-bar": Timer,
  "/application/utilisateurs": Users,
  "/application/rapports": BarChart3,
  "/application/mon-abonnement": CreditCard,
  "/application/parametres": Settings,
  "/application/station": LayoutDashboard,
  "/application/station/employes": Users,
  "/application/station/sessions": Clock3,
  "/application/station/bilans": BarChart3,
  "/application/station/parametres": Settings,
  "/application/station/pompiste": Fuel,
  "/application/station/pompiste/session": Timer,
};

type AdminSidebarProps = {
  navItems: NavItem[];
  collapsed?: boolean;
};

export function AdminSidebar({ navItems, collapsed = false }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-[#0b1220] text-slate-300 transition-[width] duration-200 ease-out ${
        collapsed ? "w-[68px]" : "w-[220px] lg:w-[240px]"
      }`}
    >
      <div
        className={`flex h-12 shrink-0 items-center border-b border-white/10 ${
          collapsed ? "justify-center px-1.5" : "px-4 lg:px-5"
        }`}
      >
        <FasoBarLogo size="sm" tone="dark" markOnly={collapsed} />
      </div>

      <nav
        className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2 pt-1.5 ${
          collapsed ? "px-1.5" : "px-2.5 lg:px-3"
        }`}
        aria-label="Navigation"
      >
        {navItems.map((item) => {
          const isHome = isHomeNavItem(item);
          const Icon = isHome
            ? LayoutDashboard
            : (NAV_ICONS[item.href] ?? Package);
          const isActive =
            pathname === item.href ||
            (item.href === "/application/station"
              ? pathname === "/application/station"
              : pathname.startsWith(`${item.href}/`)) ||
            (item.href.includes("tableau-de-bord") && pathname.includes("admin-dashboard-preview"));

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                title={item.label}
                className={`flex items-center rounded-lg text-[13px] text-slate-600 ${
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
                }`}
              >
                <Icon className="h-[15px] w-[15px] shrink-0 opacity-40" />
                {collapsed ? null : item.label}
              </span>
            );
          }

          return (
            <InstantLink
              key={item.href}
              href={item.href}
              prefetch
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center rounded-xl transition ${
                collapsed
                  ? "justify-center px-2 py-2.5"
                  : isHome
                    ? "gap-3"
                    : "gap-3"
              } ${
                isHome
                  ? isActive
                    ? collapsed
                      ? "mb-1 bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                      : "mb-1.5 gap-3 bg-emerald-600 px-3 py-3 text-[14px] font-bold text-white shadow-md shadow-emerald-950/40"
                    : collapsed
                      ? "mb-1 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
                      : "mb-1.5 gap-3 bg-emerald-500/15 px-3 py-3 text-[14px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 hover:text-emerald-200"
                  : isActive
                    ? collapsed
                      ? "bg-[#152033] text-white"
                      : "gap-3 bg-[#152033] px-3 py-[9px] text-[13px] font-semibold text-white"
                    : collapsed
                      ? "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                      : "gap-3 px-3 py-[9px] text-[13px] text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              {isActive && !isHome && !collapsed ? (
                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-emerald-500" />
              ) : null}
              {isActive && !isHome && collapsed ? (
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-emerald-500" />
              ) : null}
              <Icon
                className={`shrink-0 ${
                  isHome
                    ? `h-[18px] w-[18px] ${isActive ? "text-white" : "text-emerald-400"}`
                    : `h-[15px] w-[15px] ${isActive ? "text-emerald-400" : ""}`
                }`}
                strokeWidth={isHome ? 2.4 : 2}
              />
              {collapsed ? null : item.label}
            </InstantLink>
          );
        })}
      </nav>

      <div
        className={`shrink-0 border-t border-white/10 ${
          collapsed ? "hidden" : "px-4 py-3 text-[11px] leading-relaxed text-slate-500"
        }`}
      >
        <p>FasoBar v1.0.0</p>
        <p>© {new Date().getFullYear()} FasoBar</p>
      </div>
    </aside>
  );
}
