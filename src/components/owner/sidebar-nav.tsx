"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  enabled: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/application", label: "Tableau de bord", icon: LayoutDashboard, enabled: true },
  { href: "/application/caisse", label: "Caisse", icon: ShoppingCart, enabled: true },
  { href: "/application/commandes-ouvertes", label: "Commandes ouvertes", icon: ClipboardList, enabled: true },
  { href: "/application/ventes", label: "Ventes", icon: Receipt, enabled: false },
  { href: "/application/produits", label: "Produits", icon: Package, enabled: true },
  { href: "/application/stock", label: "Stock", icon: Boxes, enabled: true },
  { href: "/application/approvisionnements", label: "Approvisionnements", icon: Truck, enabled: true },
  { href: "/application/depenses", label: "Dépenses", icon: Wallet, enabled: false },
  { href: "/application/utilisateurs", label: "Utilisateurs", icon: Users, enabled: false },
  { href: "/application/rapports", label: "Rapports", icon: BarChart3, enabled: false },
  { href: "/application/parametres", label: "Paramètres", icon: Settings, enabled: false },
];

type SidebarNavProps = {
  establishmentName: string;
  organizationName: string;
};

export function SidebarNav({
  establishmentName,
  organizationName,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-emerald-100 bg-white">
      <div className="border-b border-emerald-50 px-6 py-5">
        <FasoBarLogo size="sm" />
        <p className="mt-2 text-sm font-medium text-slate-900">{establishmentName}</p>
        <p className="text-xs text-slate-500">{organizationName}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isHome = item.label === "Tableau de bord";
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl transition ${
                isHome
                  ? isActive
                    ? "mb-1.5 bg-emerald-600 px-3 py-3 text-[15px] font-bold text-white shadow-sm"
                    : "mb-1.5 bg-emerald-50 px-3 py-3 text-[15px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                  : isActive
                    ? "bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800"
                    : "px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className={isHome ? "h-5 w-5" : "h-4 w-4"} strokeWidth={isHome ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-emerald-50 px-4 py-4">
        <SignOutButton />
      </div>
    </aside>
  );
}
