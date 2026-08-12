"use client";

import Link from "next/link";
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
  Truck,
  Users,
  BarChart3,
  Wallet,
  Landmark,
} from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { isHomeNavItem, type NavItem } from "@/lib/navigation/space-navigation";

const NAV_ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/application/tableau-de-bord": LayoutDashboard,
  "/application/produits": Package,
  "/application/stock": Boxes,
  "/application/approvisionnements": Truck,
  "/application/depenses": Wallet,
  "/application/ventes": ShoppingBag,
  "/application/commandes": ClipboardList,
  "/application/caisses": Landmark,
  "/application/utilisateurs": Users,
  "/application/rapports": BarChart3,
  "/application/mon-abonnement": CreditCard,
  "/application/parametres": Settings,
};

type AdminSidebarProps = {
  navItems: NavItem[];
};

export function AdminSidebar({ navItems }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[#0b1220] text-slate-300 lg:w-[240px]">
      <div className="flex shrink-0 items-center px-4 py-3.5 lg:px-5 lg:py-4">
        <FasoBarLogo size="sm" tone="dark" />
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2 lg:px-3"
        aria-label="Navigation admin"
      >
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href] ?? Package;
          const isHome = isHomeNavItem(item);
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.href.includes("tableau-de-bord") && pathname.includes("admin-dashboard-preview"));

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-slate-600"
              >
                <Icon className="h-[15px] w-[15px] shrink-0 opacity-40" />
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`relative flex items-center gap-3 rounded-xl transition ${
                isHome
                  ? isActive
                    ? "mb-1.5 bg-emerald-600 px-3 py-3 text-[14px] font-bold text-white shadow-md shadow-emerald-950/40"
                    : "mb-1.5 bg-emerald-500/15 px-3 py-3 text-[14px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 hover:text-emerald-200"
                  : isActive
                    ? "bg-[#152033] px-3 py-[9px] text-[13px] font-semibold text-white"
                    : "px-3 py-[9px] text-[13px] text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              {isActive && !isHome ? (
                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-emerald-500" />
              ) : null}
              <Icon
                className={`shrink-0 ${
                  isHome
                    ? `h-[18px] w-[18px] ${isActive ? "text-white" : "text-emerald-400"}`
                    : `h-[15px] w-[15px] ${isActive ? "text-emerald-400" : ""}`
                }`}
                strokeWidth={isHome ? 2.4 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
        <p>FasoBar v1.0.0</p>
        <p>© {new Date().getFullYear()} FasoBar</p>
      </div>
    </aside>
  );
}
