"use client";

import { LayoutGrid, UtensilsCrossed, Wine } from "lucide-react";

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
  { id: "all", label: "Tous", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { id: "bar", label: "Boissons", icon: <Wine className="h-3.5 w-3.5" /> },
  { id: "kitchen", label: "Cuisine", icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
];

/** Filtres horizontaux caisse — remplace la sidebar desktop sur téléphone. */
export function MobileCaisseFilters() {
  const ctx = useFasoBarCashier();
  const filters = ctx?.caisseFilters;
  if (!filters) return null;

  const serviceScope = filters.serviceScope ?? "BOTH";
  const retail = isRetailActivity(filters.activityCode);
  const catalog = getCatalogFormProfile(filters.activityCode);
  const departments = retail
    ? []
    : DEPARTMENTS.filter((dept) => {
        if (dept.id === "bar") return hasBarService(serviceScope);
        if (dept.id === "kitchen") return hasKitchenService(serviceScope);
        return hasBarService(serviceScope) && hasKitchenService(serviceScope);
      });

  const categoryOptions = retail
    ? filters.categories
        .filter((category) => shouldShowCatalogCategory(category.name, catalog))
        .map((category) => ({
        id: category.id,
        name: category.name,
        departmentCode: category.departmentCode,
      }))
    : CAISSE_CATEGORIES.map((category) => {
        const match = filters.categories.find(
          (item) => item.name.toLowerCase() === category.name.toLowerCase(),
        );
        return {
          id: match?.id ?? category.slug,
          name: category.name,
          departmentCode: category.departmentCode,
        };
      }).filter((category) => {
        if (filters.departmentFilter === "bar") return category.departmentCode === "BAR";
        if (filters.departmentFilter === "kitchen") {
          return category.departmentCode === "KITCHEN";
        }
        return true;
      });

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white md:hidden">
      {departments.length > 0 ? (
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {departments.map((dept) => {
          const active =
            dept.id === "all"
              ? filters.departmentFilter === "all" && filters.categoryId === "all"
              : filters.departmentFilter === dept.id && filters.categoryId === "all";
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => {
                filters.onDepartmentChange(dept.id);
                filters.onCategoryChange("all");
              }}
              className={`inline-flex h-11 min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition active:scale-[0.98] ${
                active
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {dept.icon}
              {dept.label}
            </button>
          );
        })}
      </div>
      ) : null}
      {categoryOptions.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {retail ? (
            <button
              type="button"
              onClick={() => filters.onCategoryChange("all")}
              className={`inline-flex h-11 min-h-11 shrink-0 items-center rounded-full px-3.5 text-[12px] font-semibold transition active:scale-[0.98] ${
                filters.categoryId === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              Tous
            </button>
          ) : null}
          {categoryOptions.map((category) => {
            const active = filters.categoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => filters.onCategoryChange(category.id)}
                className={`inline-flex h-11 min-h-11 shrink-0 items-center rounded-full px-3.5 text-[12px] font-semibold transition active:scale-[0.98] ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
