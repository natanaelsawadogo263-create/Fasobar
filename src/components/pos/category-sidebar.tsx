"use client";

import { LayoutGrid, Tag, UtensilsCrossed, Wine } from "lucide-react";

import type { DepartmentFilter } from "@/components/pos/constants";
import type { CashierCategory } from "@/lib/orders/types";

type CategorySidebarProps = {
  categories: CashierCategory[];
  departmentFilter: DepartmentFilter;
  categoryId: string;
  onDepartmentChange: (filter: DepartmentFilter) => void;
  onCategoryChange: (categoryId: string) => void;
};

const DEPARTMENTS: {
  id: DepartmentFilter;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "all", label: "Tous", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "bar", label: "Boissons", icon: <Wine className="h-4 w-4" /> },
  { id: "kitchen", label: "Cuisine", icon: <UtensilsCrossed className="h-4 w-4" /> },
];

export function CategorySidebar({
  categories,
  departmentFilter,
  categoryId,
  onDepartmentChange,
  onCategoryChange,
}: CategorySidebarProps) {
  const filteredCategories = categories.filter((category) => {
    if (departmentFilter === "bar") return category.departmentCode === "BAR";
    if (departmentFilter === "kitchen") return category.departmentCode === "KITCHEN";
    return true;
  });

  return (
    <aside className="flex h-full w-[188px] shrink-0 flex-col border-r border-slate-800/80 bg-slate-950 xl:w-[196px]">
      {/* Navigation */}
      <nav
        className="pos-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 py-2"
        aria-label="Navigation produits"
      >
        {/* Départements */}
        <section>
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Départements
          </p>
          <div className="space-y-0.5">
            {DEPARTMENTS.map((dept) => {
              const active =
                dept.id === "all"
                  ? departmentFilter === "all" && categoryId === "all"
                  : departmentFilter === dept.id;

              return (
                <SidebarButton
                  key={dept.id}
                  active={active}
                  icon={dept.icon}
                  label={dept.label}
                  onClick={() => {
                    onDepartmentChange(dept.id);
                    onCategoryChange("all");
                  }}
                />
              );
            })}
          </div>
        </section>

        {/* Catégories */}
        <section className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Catégories
            </p>
            {filteredCategories.length > 0 ? (
              <span className="rounded-full bg-slate-800 px-1.5 py-px text-[9px] font-medium text-slate-400">
                {filteredCategories.length}
              </span>
            ) : null}
          </div>

          {filteredCategories.length === 0 ? (
            <div className="mx-1 rounded-lg border border-dashed border-slate-800 px-2 py-4 text-center">
              <Tag className="mx-auto h-4 w-4 text-slate-600" aria-hidden="true" />
              <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
                Aucune catégorie dans ce département
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredCategories.map((category) => (
                <SidebarButton
                  key={category.id}
                  active={categoryId === category.id}
                  label={category.name}
                  onClick={() => onCategoryChange(category.id)}
                />
              ))}
            </div>
          )}
        </section>
      </nav>

      {/* Raccourcis clavier */}
      <footer className="shrink-0 border-t border-slate-800/80 px-2.5 py-2">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
          Raccourcis
        </p>
        <ul className="space-y-0.5 text-[10px] text-slate-500">
          <li className="flex items-center justify-between gap-2">
            <span>Recherche</span>
            <kbd className="rounded border border-slate-700 bg-slate-900 px-1 font-mono text-[9px] text-slate-400">
              F2
            </kbd>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Commandes</span>
            <kbd className="rounded border border-slate-700 bg-slate-900 px-1 font-mono text-[9px] text-slate-400">
              F4
            </kbd>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Encaisser</span>
            <kbd className="rounded border border-slate-700 bg-slate-900 px-1 font-mono text-[9px] text-slate-400">
              F8
            </kbd>
          </li>
        </ul>
      </footer>
    </aside>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition ${
        active
          ? "bg-emerald-600 font-semibold text-white shadow-sm ring-1 ring-emerald-500/30"
          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
      }`}
    >
      {icon ? (
        <span
          className={`shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}
        >
          {icon}
        </span>
      ) : (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            active ? "bg-white" : "bg-slate-600 group-hover:bg-slate-400"
          }`}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
