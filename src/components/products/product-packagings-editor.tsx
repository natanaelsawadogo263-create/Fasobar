"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  deactivatePackagingAction,
  upsertPackagingAction,
} from "@/app/(protected)/application/produits/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import {
  BAR_PACKAGING_DEFAULT_UNITS,
  BAR_PACKAGING_LABELS,
  BAR_PACKAGING_UNITS,
  PRODUCT_UNIT_LABELS,
  SHOP_PACKAGING_DEFAULT_UNITS,
  SHOP_PACKAGING_UNITS,
  packagingDisplayName,
} from "@/lib/products/constants";
import type { BarPackagingUnit } from "@/lib/products/schemas";
import type { ProductPackaging } from "@/lib/products/types";

type ProductPackagingsEditorProps = {
  productId: string;
  baseUnit: string;
  packagings: ProductPackaging[];
  onChanged: () => void;
  shopLots?: boolean;
};

export function ProductPackagingsEditor({
  productId,
  baseUnit,
  packagings,
  onChanged,
  shopLots = false,
}: ProductPackagingsEditorProps) {
  const packagingChoices = shopLots ? SHOP_PACKAGING_UNITS : BAR_PACKAGING_UNITS;
  const defaultUnit: BarPackagingUnit = shopLots ? "CARTON" : "CASE";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [packagingUnit, setPackagingUnit] = useState<BarPackagingUnit>(defaultUnit);
  const [unitsPerPack, setUnitsPerPack] = useState(
    String(
      shopLots
        ? SHOP_PACKAGING_DEFAULT_UNITS.CARTON
        : BAR_PACKAGING_DEFAULT_UNITS.CASE,
    ),
  );
  const [lotSellingPrice, setLotSellingPrice] = useState("");

  const baseLabel =
    PRODUCT_UNIT_LABELS[baseUnit as keyof typeof PRODUCT_UNIT_LABELS] ?? baseUnit;
  const packagingLabel = BAR_PACKAGING_LABELS[packagingUnit];

  function handleAdd() {
    if (shopLots && !(Number(lotSellingPrice) > 0)) {
      setError("Indiquez le prix de vente du lot.");
      return;
    }
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("name", packagingDisplayName(packagingUnit));
    formData.set("packagingUnit", packagingUnit);
    formData.set("conversionFactor", unitsPerPack);
    if (shopLots) {
      formData.set("lotSellingPrice", lotSellingPrice);
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await upsertPackagingAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Conditionnement enregistré.");
      setPackagingUnit(defaultUnit);
      setUnitsPerPack(
        String(
          shopLots
            ? SHOP_PACKAGING_DEFAULT_UNITS.CARTON
            : BAR_PACKAGING_DEFAULT_UNITS.CASE,
        ),
      );
      setLotSellingPrice("");
      onChanged();
    });
  }

  function handleDeactivate(packagingId: string) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("packagingId", packagingId);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await deactivatePackagingAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Conditionnement désactivé.");
      onChanged();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div>
        <h3 className="text-[13px] font-semibold text-slate-900">
          {shopLots ? "Lots d’achat / vente" : "Conditionnements d'achat"}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {shopLots
            ? `Pack, carton ou paquet, le nombre d’unités, et le prix de vente du lot. Unité : ${baseLabel.toLowerCase()}.`
            : `Format d'achat (casier, carton ou sachet) et nombre d'exemplaires à l'intérieur. Unité de vente : ${baseLabel.toLowerCase()}.`}
        </p>
      </div>

      {error ? <AlertMessage message={error} /> : null}
      {success ? (
        <AlertMessage
          message={success}
          tone="success"
          onDismiss={() => setSuccess(null)}
        />
      ) : null}

      <ul className="space-y-1.5">
        {packagings.length === 0 ? (
          <li className="text-[12px] text-amber-700">
            {shopLots
              ? "Aucun lot configuré — ajoutez un pack, un carton ou un paquet si besoin."
              : "Aucun conditionnement configuré — ajoutez au moins un format (casier / carton / sachet)."}
          </li>
        ) : (
          packagings.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px]"
            >
              <span className="font-medium text-slate-800">
                1{" "}
                {BAR_PACKAGING_LABELS[
                  item.packagingUnit as BarPackagingUnit
                ]?.toLowerCase() ?? item.name}{" "}
                = {item.conversionFactor} {baseLabel.toLowerCase()}
                {item.conversionFactor > 1 ? "s" : ""}
                {item.sellingPrice
                  ? ` · ${item.sellingPrice} F`
                  : ""}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDeactivate(item.id)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Retirer
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={packagingUnit}
          onChange={(event) => {
            const next = event.target.value as BarPackagingUnit;
            setPackagingUnit(next);
            const shopDefault =
              shopLots && (SHOP_PACKAGING_UNITS as readonly string[]).includes(next)
                ? SHOP_PACKAGING_DEFAULT_UNITS[next as (typeof SHOP_PACKAGING_UNITS)[number]]
                : undefined;
            setUnitsPerPack(String(shopDefault ?? BAR_PACKAGING_DEFAULT_UNITS[next]));
          }}
          aria-label="Format d'achat"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] sm:h-9 sm:min-h-9"
        >
          {packagingChoices.map((unit) => (
            <option key={unit} value={unit}>
              {BAR_PACKAGING_LABELS[unit]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          step={1}
          value={unitsPerPack}
          onChange={(event) => setUnitsPerPack(event.target.value)}
          placeholder="Exemplaires"
          aria-label="Nombre d'exemplaires à l'intérieur"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] sm:h-9 sm:min-h-9"
        />
        {shopLots ? (
          <input
            type="number"
            min={1}
            step={1}
            value={lotSellingPrice}
            onChange={(event) => setLotSellingPrice(event.target.value)}
            placeholder={`Prix du ${packagingLabel.toLowerCase()} (F)`}
            aria-label="Prix de vente du lot"
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] sm:h-9 sm:min-h-9"
          />
        ) : null}
        <button
          type="button"
          disabled={
            isPending ||
            !(Number(unitsPerPack) > 1) ||
            (shopLots && !(Number(lotSellingPrice) > 0))
          }
          onClick={handleAdd}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:h-9 sm:min-h-9"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>

      {Number(unitsPerPack) > 0 ? (
        <p className="text-[12px] font-medium text-emerald-700">
          1 {packagingLabel.toLowerCase()} = {unitsPerPack}{" "}
          {baseLabel.toLowerCase()}
          {Number(unitsPerPack) > 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  );
}
