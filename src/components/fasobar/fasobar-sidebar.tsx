"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, UtensilsCrossed, Wine } from "lucide-react";

import { useFasoBarCashier } from "@/components/fasobar/fasobar-cashier-context";
import { CAISSE_CATEGORIES } from "@/lib/caisse/catalog";
import type { DepartmentFilter } from "@/components/pos/constants";
import { hasBarService, hasKitchenService } from "@/lib/settings/service-scope";

const DEPARTMENTS: {
  id: DepartmentFilter;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "all", label: "Tous", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "bar", label: "Boissons", icon: <Wine className="h-4 w-4" /> },
  { id: "kitchen", label: "Cuisine", icon: <UtensilsCrossed className="h-4 w-4" /> },
];

export function FasoBarSidebar() {
  const pathname = usePathname();
  const ctx = useFasoBarCashier();
  const filters = ctx?.caisseFilters;
  const serviceScope = filters?.serviceScope ?? "BOTH";
  const departments = DEPARTMENTS.filter((dept) => {
    if (dept.id === "bar") return hasBarService(serviceScope);
    if (dept.id === "kitchen") return hasKitchenService(serviceScope);
    return hasBarService(serviceScope) && hasKitchenService(serviceScope);
  });
  const isCaisse = pathname === "/application/caisse" || pathname.startsWith("/application/caisse?");

  const categoryOptions = isCaisse
    ? CAISSE_CATEGORIES.map((category) => {
        const match = filters?.categories.find(
          (item) => item.name.toLowerCase() === category.name.toLowerCase(),
        );
        return {
          id: match?.id ?? category.slug,
          name: category.name,
          departmentCode: category.departmentCode,
          isStatic: !match,
        };
      }).filter((category) => {
        if (filters?.departmentFilter === "bar") return category.departmentCode === "BAR";
        if (filters?.departmentFilter === "kitchen") return category.departmentCode === "KITCHEN";
        return true;
      })
    : (filters?.categories ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        departmentCode: category.departmentCode,
        isStatic: false,
      }));

  return (
    <aside className="fasobar-sidebar flex h-full w-[200px] shrink-0 flex-col bg-[#0b1220] text-slate-300">
      <nav className="pos-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Départements
        </p>
        <div className="space-y-0.5">
          {departments.map((dept) => {
            const active =
              isCaisse &&
              filters &&
              (dept.id === "all"
                ? filters.departmentFilter === "all" && filters.categoryId === "all"
                : filters.departmentFilter === dept.id);

            return (
              <SidebarItem
                key={dept.id}
                active={Boolean(active)}
                icon={dept.icon}
                label={dept.label}
                onClick={
                  filters
                    ? () => {
                        filters.onDepartmentChange(dept.id);
                        filters.onCategoryChange("all");
                      }
                    : undefined
                }
                href={!filters ? `/application/caisse?dept=${dept.id}` : undefined}
              />
            );
          })}
        </div>

        {categoryOptions.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Catégories
            </p>
            <div className="space-y-0.5">
              {categoryOptions.map((category) => (
                <SidebarItem
                  key={category.id}
                  active={filters?.categoryId === category.id}
                  label={category.name}
                  onClick={filters ? () => filters.onCategoryChange(category.id) : undefined}
                />
              ))}
            </div>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}

function SidebarItem({
  active,
  icon,
  label,
  onClick,
  href,
}: {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className = `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${
    active
      ? "bg-emerald-600 font-semibold text-white shadow-sm"
      : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : "bg-slate-600"}`}
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}
