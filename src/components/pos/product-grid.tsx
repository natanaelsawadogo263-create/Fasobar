"use client";

import { LayoutGrid, LayoutList, PackagePlus, PackageSearch, SearchX, X } from "lucide-react";
import { useState, type KeyboardEvent, type RefObject } from "react";

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
  onSearchKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  shopLots?: boolean;
  /** Code scanné sans correspondance — bandeau non bloquant, pas de pop-up. */
  unknownBarcode?: string | null;
  onDismissUnknownBarcode?: () => void;
  onCreateFromBarcode?: () => void;
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
  onSearchKeyDown,
  searchInputRef,
  shopLots = false,
  unknownBarcode = null,
  onDismissUnknownBarcode,
  onCreateFromBarcode,
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
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${
                  viewMode === "grid" ? "bg-emerald-600 text-white" : "text-slate-500"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${
                  viewMode === "list" ? "bg-emerald-600 text-white" : "text-slate-500"
                }`}
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <ProductSearch
          ref={searchInputRef}
          value={search}
          onChange={onSearchChange}
          onKeyDown={onSearchKeyDown}
          variant="light"
        />

        {unknownBarcode ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <PackageSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <strong className="font-semibold">Produit introuvable</strong> — code détecté :{" "}
              <span className="font-mono">{unknownBarcode}</span>
            </span>
            {onCreateFromBarcode ? (
              <button
                type="button"
                onClick={onCreateFromBarcode}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500"
              >
                <PackagePlus className="h-3.5 w-3.5" />
                Créer ce produit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDismissUnknownBarcode}
              aria-label="Fermer"
              className="shrink-0 rounded-lg p-1 text-amber-700 hover:bg-amber-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
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
                shopLots={shopLots}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
