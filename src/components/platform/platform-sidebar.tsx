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
import type { PlatformNavItem } from "@/lib/platform/navigation";

const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/platform": LayoutDashboard,
  "/platform/clients": Users,
  "/platform/demandes": FileText,
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
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[#0b1220] text-slate-300 lg:w-[248px]">
      <div className="flex shrink-0 items-center px-4 py-4 lg:px-5">
        <FasoBarLogo size="sm" tone="dark" />
      </div>

      <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Super Admin
      </p>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2 lg:px-3"
        aria-label="Navigation plateforme"
      >
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
          const isActive =
            item.href === "/platform"
              ? pathname === "/platform"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                title="Bientôt disponible"
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-slate-600"
              >
                <Icon className="h-[15px] w-[15px] shrink-0 opacity-40" />
                <span className="truncate">{item.label}</span>
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
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
        <p>FasoBar Platform</p>
        <p>© {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
