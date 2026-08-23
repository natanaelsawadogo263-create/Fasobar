"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";

type ProductSearchProps = {
  value: string;
  onChange: (value: string) => void;
  variant?: "light" | "dark";
  compact?: boolean;
  disabled?: boolean;
  /** Reçoit Enter — utilisé pour détecter un scan code-barres (douchette USB). */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export const ProductSearch = forwardRef<HTMLInputElement, ProductSearchProps>(
  function ProductSearch(
    { value, onChange, variant = "light", compact = false, disabled = false, onKeyDown },
    ref,
  ) {
    const isDark = variant === "dark";

    return (
      <div className="relative min-w-0">
        <Search
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
            compact ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4"
          } ${isDark ? "text-slate-500" : "text-emerald-600"}`}
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="search"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={compact ? "Rechercher…" : "Rechercher un article…"}
          aria-label="Rechercher un article"
          title="Rechercher un produit (F2 ou /)"
          className={`w-full rounded-lg outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            compact
              ? "h-11 py-2 pl-8 pr-8 text-[16px] leading-none"
              : "h-11 py-2.5 pl-10 pr-3 text-[16px] sm:text-sm"
          } ${
            isDark
              ? "border border-slate-700/80 bg-[#111827] text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              : "border border-emerald-500 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-emerald-500/20"
          }`}
        />
        {compact ? (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-700 bg-slate-800 px-1 py-px text-[9px] font-medium text-slate-400">
            /
          </kbd>
        ) : null}
      </div>
    );
  },
);
