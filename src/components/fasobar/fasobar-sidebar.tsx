"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, PanelLeftClose, PanelLeftOpen, UtensilsCrossed, Wine } from "lucide-react";

import { useFasoBarCashier } from "@/components/fasobar/fasobar-cashier-context";
import { CAISSE_CATEGORIES } from "@/lib/caisse/catalog";
import type { DepartmentFilter } from "@/components/pos/constants";
import { getCatalogFormProfile, shouldShowCatalogCategory } from "@/lib/activity/catalog";
import { isRetailActivity } from "@/lib/activity/profile";
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

type FasoBarSidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};

export function FasoBarSidebar({ collapsed = false, onToggle }: FasoBarSidebarProps) {
  const pathname = usePathname();
  const ctx = useFasoBarCashier();
  const filters = ctx?.caisseFilters;
  const serviceScope = filters?.serviceScope ?? "BOTH";
  const retail = isRetailActivity(filters?.activityCode);
  const catalog = getCatalogFormProfile(filters?.activityCode);
  const departments = retail
    ? []
    : DEPARTMENTS.filter((dept) => {
        if (dept.id === "bar") return hasBarService(serviceScope);
        if (dept.id === "kitchen") return hasKitchenService(serviceScope);
        return hasBarService(serviceScope) && hasKitchenService(serviceScope);
      });
  const isCaisse = pathname === "/application/caisse" || pathname.startsWith("/application/caisse?");

  const categoryOptions =
    isCaisse && !retail
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
      : (filters?.categories ?? [])
          .filter((category) => shouldShowCatalogCategory(category.name, catalog))
          .map((category) => ({
          id: category.id,
          name: category.name,
          departmentCode: category.departmentCode,
          isStatic: false,
        }));

  return (
    <aside
      className={`fasobar-sidebar flex h-full shrink-0 flex-col border-r border-white/10 bg-[#0b1220] text-slate-300 transition-[width] duration-200 ease-out ${
        collapsed ? "w-[56px]" : "w-[200px]"
      }`}
    >
      <div
        className={`flex h-11 shrink-0 items-center border-b border-white/10 ${
          collapsed ? "justify-center px-1" : "justify-between gap-2 px-2.5"
        }`}
      >
        {collapsed ? null : (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Menu
          </p>
        )}
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? "Afficher le menu" : "Masquer le menu"}
            aria-label={collapsed ? "Afficher le menu" : "Masquer le menu"}
            aria-expanded={!collapsed}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 text-emerald-400" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <nav
        className={`pos-scroll flex min-h-0 flex-1 flex-col overflow-y-auto py-2 ${
          collapsed ? "px-1.5" : "px-2"
        }`}
      >
        {collapsed || departments.length === 0 ? null : (
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Départements
          </p>
        )}
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
                collapsed={collapsed}
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

        {!collapsed && categoryOptions.length > 0 ? (
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
  collapsed = false,
}: {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  collapsed?: boolean;
}) {
  const className = `flex w-full items-center rounded-lg text-left text-[12px] transition ${
    collapsed ? "h-10 justify-center px-0" : "gap-2.5 px-2.5 py-2"
  } ${
    active
      ? "bg-emerald-600 font-semibold text-white shadow-sm"
      : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

  const content = (
    <>
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : collapsed ? null : (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : "bg-slate-600"}`}
        />
      )}
      {collapsed ? null : <span className="truncate">{label}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} title={label} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      title={label}
      aria-label={label}
    >
      {content}
    </button>
  );
}
