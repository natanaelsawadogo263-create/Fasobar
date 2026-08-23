"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";

import type { StockListItem } from "@/lib/stock/types";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function itemHaystack(item: StockListItem) {
  return normalizeSearch(
    [item.name, item.unit, item.stockUnitLabel, item.categoryName, item.departmentName]
      .filter(Boolean)
      .join(" "),
  );
}

function matchesQuery(item: StockListItem, query: string) {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = itemHaystack(item);
  return tokens.every((token) => hay.includes(token));
}

type StockArticleSearchProps = {
  items: StockListItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  optionLabel?: (item: StockListItem) => string;
  /** Reçoit Entrée — utilisé pour détecter un scan code-barres (douchette USB). */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function StockArticleSearch({
  items,
  value,
  onChange,
  label,
  optionLabel,
  onKeyDown,
}: StockArticleSearchProps) {
  const listId = useId();
  const selected = items.find((item) => item.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = query.trim() ? items.filter((item) => matchesQuery(item, query)) : items;
  const shown = filtered.slice(0, 80);

  function pick(item: StockListItem) {
    setQuery("");
    setOpen(false);
    onChange(item.id);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={`${listId}-input`} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        {/* Icône scopée au seul champ (pas au bloc entier) : sinon top-1/2 se
           recalcule sur la hauteur input + liste ouverte et l'icône « flotte »
           au milieu des résultats au lieu de rester dans le champ. */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600"
            aria-hidden
          />
          <input
            id={`${listId}-input`}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Tapez le nom du produit…"
            value={open ? query : (selected?.name ?? "")}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              if (value) onChange("");
            }}
            onFocus={() => {
              setQuery("");
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => {
              window.setTimeout(() => {
                setOpen(false);
                setQuery("");
              }, 120);
            }}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-sm"
          >
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">Aucun produit correspondant.</li>
            ) : (
              shown.map((item) => {
                const active = item.id === value;
                return (
                  <li key={item.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(item)}
                      className={`flex min-h-11 w-full items-center px-3 text-left text-sm ${
                        active
                          ? "bg-emerald-50 font-semibold text-emerald-900"
                          : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {optionLabel ? optionLabel(item) : item.name}
                    </button>
                  </li>
                );
              })
            )}
            {filtered.length > shown.length ? (
              <li className="px-3 py-2 text-[12px] text-slate-500">
                Affinez la recherche pour voir les autres produits.
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
