"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { SPACE_LABELS, type UserSpace } from "@/lib/auth/roles";
import type { NavItem } from "@/lib/navigation/space-navigation";

type SpaceSidebarProps = {
  space: UserSpace;
  establishmentName: string;
  organizationName: string;
  navItems: NavItem[];
};

export function SpaceSidebar({
  space,
  establishmentName,
  organizationName,
  navItems,
}: SpaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-emerald-100 bg-white">
      <div className="shrink-0 border-b border-emerald-50 px-5 py-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          FasoBar
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          {SPACE_LABELS[space]}
        </p>
        <p className="mt-2 truncate text-sm font-medium text-slate-900">{establishmentName}</p>
        <p className="truncate text-xs text-slate-500">{organizationName}</p>
      </div>

      <nav className="app-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3" aria-label="Navigation principale">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
              >
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-emerald-50 font-medium text-emerald-800"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-emerald-50 px-4 py-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
