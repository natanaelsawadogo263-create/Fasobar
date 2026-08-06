"use client";

import Image from "next/image";
import { Plus } from "lucide-react";

import { POS_DEPARTMENT_BADGE } from "@/components/pos/constants";
import { formatPriceXof } from "@/lib/orders/constants";
import { getProductImage } from "@/lib/fasobar/product-images";
import type { CashierProduct } from "@/lib/orders/types";
import type { DepartmentCode } from "@/lib/products/schemas";

type ProductCardProps = {
  product: CashierProduct;
  disabled?: boolean;
  flash?: boolean;
  onAdd: (product: CashierProduct) => void;
  variant?: "grid" | "list";
};

export function ProductCard({
  product,
  disabled,
  flash,
  onAdd,
  variant = "grid",
}: ProductCardProps) {
  const department = product.departmentCode as DepartmentCode;
  const badge = POS_DEPARTMENT_BADGE[department];
  const imageUrl = getProductImage(product.name, product.imageUrl);

  if (variant === "list") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(product)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-emerald-400 disabled:opacity-50"
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
          <Image src={imageUrl} alt={product.name} fill className="object-contain p-1" unoptimized />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase text-slate-900">{product.name}</p>
          <p className="truncate text-[10px] text-slate-500">{product.categoryName}</p>
        </div>
        <p className="pos-tabular shrink-0 text-sm font-bold text-emerald-600">
          {formatPriceXof(product.sellingPrice)}
        </p>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(product)}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
        flash
          ? "border-emerald-500 ring-2 ring-emerald-400/30"
          : "border-slate-200/90 hover:border-emerald-400/60 hover:shadow-md"
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-contain p-3 transition group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 50vw, 20vw"
          unoptimized
        />
        <span
          className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
        <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#DCFCE7] text-[#166534] shadow-sm">
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-1">
        <p className="line-clamp-2 text-[11px] font-bold uppercase leading-snug tracking-wide text-slate-900">
          {product.name}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-slate-500">{product.categoryName}</p>
        <p className="pos-tabular mt-1.5 text-[13px] font-bold text-emerald-600">
          {formatPriceXof(product.sellingPrice)}
        </p>
      </div>
    </button>
  );
}
