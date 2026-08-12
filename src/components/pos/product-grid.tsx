"use client";

import { LayoutGrid, LayoutList, PackageSearch, SearchX } from "lucide-react";
import { useState, type RefObject } from "react";

import { ProductCard } from "@/components/pos/product-card";
import { ProductSearch } from "@/components/pos/product-search";
import type { CashierProduct } from "@/lib/orders/types";

type ProductGridProps = {
  title: string;
  products: CashierProduct[];
  totalCount: number;
  isPending?: boolean;
  flashProductId?: string | null;
  onAddProduct: (product: CashierProduct) => void;
  hasSearch: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
};

export function ProductGrid({
  title,
  products,
  totalCount,
  isPending,
  flashProductId,
  onAddProduct,
  hasSearch,
  search,
  onSearchChange,
  searchInputRef,
}: ProductGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f4f6f9]">
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
            <p className="text-[11px] text-slate-500" suppressHydrationWarning>
              {totalCount} produit{totalCount > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-1.5 sm:flex">
              <span className="text-[11px] text-slate-500">Trier par</span>
              <select className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none">
                <option>Nom</option>
                <option>Prix</option>
              </select>
            </label>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                className={`inline-flex h-7 w-7 items-center justify-center rounded ${
                  viewMode === "grid" ? "bg-emerald-600 text-white" : "text-slate-500"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={`inline-flex h-7 w-7 items-center justify-center rounded ${
                  viewMode === "list" ? "bg-emerald-600 text-white" : "text-slate-500"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <ProductSearch
          ref={searchInputRef}
          value={search}
          onChange={onSearchChange}
          variant="light"
        />
      </div>

      <div className="pos-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
              {hasSearch ? (
                <SearchX className="h-6 w-6" aria-hidden="true" />
              ) : (
                <PackageSearch className="h-6 w-6" aria-hidden="true" />
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              {hasSearch ? "Aucun résultat" : "Aucun produit"}
            </h3>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4"
                : "space-y-2"
            }
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                disabled={isPending}
                flash={flashProductId === product.id}
                onAdd={onAddProduct}
                variant={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
