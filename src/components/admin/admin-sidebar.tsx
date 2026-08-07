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
  Wine,
  GlassWater,
  BarChart3,
  Wallet,
  Landmark,
} from "lucide-react";

import type { NavItem } from "@/lib/navigation/space-navigation";

const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
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
      <div className="flex shrink-0 items-center gap-2.5 px-4 py-3.5 lg:px-5 lg:py-4">
        <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a2336] text-amber-400 ring-1 ring-amber-500/35">
          <Wine className="h-4 w-4" strokeWidth={2.25} />
          <GlassWater
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-amber-300"
            strokeWidth={2.25}
          />
        </span>
        <span className="text-[20px] font-bold tracking-tight text-amber-400">FasoBar</span>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2 lg:px-3"
        aria-label="Navigation admin"
      >
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href] ?? Package;
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
              className={`relative flex items-center gap-3 rounded-lg px-3 py-[9px] text-[13px] transition ${
                isActive
                  ? "bg-[#152033] font-semibold text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              {isActive ? (
                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-emerald-500" />
              ) : null}
              <Icon
                className={`h-[15px] w-[15px] shrink-0 ${isActive ? "text-emerald-400" : ""}`}
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
