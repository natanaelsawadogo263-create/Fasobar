"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { X } from "lucide-react";

import { AlertMessage } from "@/components/auth/alert-message";
import { ProductImageField, type ProductImageAssets } from "@/components/products/product-image-field";
import {
  NumberField,
  PriceField,
  SelectField,
  TextField,
} from "@/components/ui/form-controls";
import {
  loadHardwareProductDraftAction,
  saveHardwareProductAction,
} from "@/app/(protected)/application/produits/hardware-catalog-actions";
import type { CategoryOption } from "@/lib/products/types";
import {
  HARDWARE_STOCK_UNIT_SUGGESTIONS,
  HARDWARE_WHOLESALE_PACKS,
} from "@/lib/hardware/product-catalog-constants";
import { type SaleTypeId } from "@/lib/catalog/sale-types";
import type {
  HardwareProductDraft,
  HardwareUnitLevel,
} from "@/lib/hardware/product-catalog-types";
import { emptyHardwareDraft, emptyHardwareUnits } from "@/lib/hardware/product-catalog-types";

type HardwareProductWizardProps = {
  mode: "create" | "edit";
  productId?: string | null;
  categories: CategoryOption[];
  initialCategoryId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
};

function isKnownUnit(value: string) {
  return HARDWARE_STOCK_UNIT_SUGGESTIONS.includes(
    value as (typeof HARDWARE_STOCK_UNIT_SUGGESTIONS)[number],
  );
}

function stockUnitOf(draft: HardwareProductDraft): string {
  if (draft.stockUnit === "__custom__") return draft.customStockUnit.trim() || "pièce";
  return draft.stockUnit || "pièce";
}

function extraPacks(units: HardwareUnitLevel[]): HardwareUnitLevel[] {
  return units.filter((unit) => !unit.isBase && unit.clientId !== "base");
}

function baseSelling(units: HardwareUnitLevel[]): number {
  return units.find((unit) => unit.isBase || unit.clientId === "base")?.sellingPrice ?? 0;
}

function inferSaleType(unit: string, fractionable: boolean, hasPacks: boolean): SaleTypeId {
  const n = unit.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n === "kg" || n === "kilo" || n === "gramme") return "WEIGHT";
  if (n === "metre" || n === "m" || n === "cm") return "LENGTH";
  if (n === "litre" || n === "l") return "VOLUME";
  if (hasPacks) return "PACKS";
  if (fractionable) return "UNIT";
  return "UNIT";
}

function emptyPack(name = "carton"): HardwareUnitLevel {
  return {
    clientId: crypto.randomUUID(),
    name,
    parentClientId: "base",
    containsQty: 50,
    isBase: false,
    purchasable: true,
    sellable: true,
    purchasePrice: 0,
    sellingPrice: 0,
    allowDecimal: false,
  };
}

function pricedUnits(
  stockUnit: string,
  sellingPrice: number,
  packs: HardwareUnitLevel[],
  allowDecimal = false,
): HardwareUnitLevel[] {
  const base: HardwareUnitLevel = {
    ...emptyHardwareUnits(stockUnit)[0],
    sellable: sellingPrice > 0,
    sellingPrice,
    purchasable: true,
    purchasePrice: 0,
    allowDecimal,
  };
  return [
    base,
    ...packs.map((pack) => ({
      ...pack,
      parentClientId: "base",
      isBase: false,
      sellable: pack.sellingPrice > 0,
      purchasable: true,
      purchasePrice: 0,
      allowDecimal: false,
    })),
  ];
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
        {hint ? <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function YesNo({
  yes,
  onChange,
}: {
  yes: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`min-h-12 rounded-xl border text-[14px] font-semibold ${
          yes ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-200 text-slate-700"
        }`}
      >
        Oui
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`min-h-12 rounded-xl border text-[14px] font-semibold ${
          !yes ? "border-slate-400 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-700"
        }`}
      >
        Non
      </button>
    </div>
  );
}

export function HardwareProductWizard({
  mode,
  productId = null,
  categories,
  initialCategoryId = "",
  onClose,
  onSaved,
}: HardwareProductWizardProps) {
  const [draft, setDraft] = useState<HardwareProductDraft>(() =>
    emptyHardwareDraft(initialCategoryId),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [imageAssets, setImageAssets] = useState<ProductImageAssets>({ file: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode === "edit" && productId) {
        const loaded = await loadHardwareProductDraftAction(productId);
        if (!cancelled && loaded.draft) {
          const next = loaded.draft;
          const known = isKnownUnit(next.stockUnit);
          setDraft({
            ...next,
            stockUnit: known ? next.stockUnit : "__custom__",
            customStockUnit: known ? "" : next.customStockUnit || next.stockUnit,
            useVariants: false,
            variants: [],
          });
        }
        if (!cancelled && loaded.error) setError(loaded.error);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, productId]);

  function patch(partial: Partial<HardwareProductDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setError(null);
  }

  const stockUnit = stockUnitOf(draft);
  const packs = extraPacks(draft.units);
  const selling = baseSelling(draft.units);
  const hasWholesale = packs.length > 0;
  const pack = packs[0];

  function setUnits(nextPacks: HardwareUnitLevel[], nextSelling = selling, detail = draft.fractionable) {
    patch({
      units: pricedUnits(stockUnit, nextSelling, nextPacks, detail),
      fractionable: detail,
    });
  }

  function handleSave() {
    if (draft.name.trim().length < 2) {
      setError("Indiquez le nom du produit (ex. Ampoule LED 12 W).");
      return;
    }
    if (!draft.categoryId || draft.categoryId === "__new__") {
      if (draft.newCategoryName.trim().length < 2) {
        setError("Choisissez une catégorie.");
        return;
      }
    }
    if (!stockUnit) {
      setError("Comment comptez-vous ce produit ?");
      return;
    }
    if (selling <= 0) {
      setError("Indiquez le prix de vente par unité.");
      return;
    }
    if (hasWholesale) {
      if (!pack?.name.trim() || !(pack.containsQty > 1) || pack.sellingPrice <= 0) {
        setError("Pour le gros : type, nombre d’unités, et prix du conditionnement.");
        return;
      }
    }

    startTransition(async () => {
      const toSave: HardwareProductDraft = {
        ...draft,
        saleType: inferSaleType(stockUnit, draft.fractionable, hasWholesale),
        useVariants: false,
        variants: [],
        fractionPrecision: draft.fractionable ? 0.1 : draft.fractionPrecision,
        units: pricedUnits(stockUnit, selling, hasWholesale ? packs.slice(0, 1) : [], draft.fractionable),
      };
      const formData = new FormData();
      formData.set("draft", JSON.stringify(toSave));
      if (imageAssets.file) {
        formData.set("imageOriginal", imageAssets.file);
        formData.set("image", imageAssets.file);
      }
      const result = await saveHardwareProductAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved(result.success ?? "Article enregistré.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:max-w-[520px] sm:rounded-2xl">
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-semibold text-slate-900">
              {mode === "create" ? "Nouveau produit" : "Modifier le produit"}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Un article différent = un produit. Mettez la taille dans le nom.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error ? (
            <div className="mb-3">
              <AlertMessage message={error} />
            </div>
          ) : null}
          {loading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ) : (
            <div className="grid gap-3">
              <Section title="Le produit">
                <TextField
                  id="hw-name"
                  name="name"
                  label="Nom du produit"
                  required
                  placeholder="Ex : Ampoule LED 12 W"
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                />
                <SelectField
                  id="hw-cat"
                  name="categoryId"
                  label="Catégorie"
                  required
                  value={draft.categoryId === "__new__" ? "__new__" : draft.categoryId}
                  onChange={(event) => patch({ categoryId: event.target.value, newCategoryName: "" })}
                >
                  <option value="">Choisir…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  <option value="__new__">+ Nouvelle catégorie</option>
                </SelectField>
                {draft.categoryId === "__new__" ? (
                  <TextField
                    id="hw-new-cat"
                    name="newCategoryName"
                    label="Nom de la catégorie"
                    value={draft.newCategoryName}
                    onChange={(event) =>
                      patch({ newCategoryName: event.target.value, categoryId: "__new__" })
                    }
                  />
                ) : null}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">Photo (facultatif)</p>
                  <ProductImageField
                    compact
                    existingUrl={draft.imageUrl}
                    onAssetsChange={setImageAssets}
                  />
                </div>
              </Section>

              <Section
                title="Comment comptez-vous ce produit ?"
                hint="C’est l’unité du stock. Câble en rouleau → rouleau. Ampoule → pièce."
              >
                <SelectField
                  id="hw-unit"
                  name="stockUnit"
                  label="Unité de stock"
                  value={isKnownUnit(draft.stockUnit) ? draft.stockUnit : "__custom__"}
                  onChange={(event) => {
                    const value = event.target.value;
                    const nextUnit = value === "__custom__" ? draft.customStockUnit || "pièce" : value;
                    patch({
                      stockUnit: value,
                      customStockUnit: value === "__custom__" ? draft.customStockUnit : "",
                      units: pricedUnits(nextUnit, selling, packs, draft.fractionable),
                    });
                  }}
                >
                  {HARDWARE_STOCK_UNIT_SUGGESTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  <option value="__custom__">Autre…</option>
                </SelectField>
                {!isKnownUnit(draft.stockUnit) ? (
                  <TextField
                    id="hw-unit-custom"
                    name="customStockUnit"
                    label="Unité"
                    placeholder="Ex : seau"
                    value={draft.customStockUnit}
                    onChange={(event) =>
                      patch({
                        stockUnit: "__custom__",
                        customStockUnit: event.target.value,
                        units: pricedUnits(event.target.value || "pièce", selling, packs, draft.fractionable),
                      })
                    }
                  />
                ) : null}
                <PriceField
                  id="hw-price"
                  name="sellingPrice"
                  label={`Prix de vente / ${stockUnit}`}
                  required
                  value={selling || ""}
                  onChange={(event) =>
                    setUnits(packs, Number(event.target.value) || 0)
                  }
                />
                <NumberField
                  id="hw-min"
                  name="minimumStock"
                  label="Stock minimum"
                  hint={`On prévient quand il reste trop peu de ${stockUnit}s.`}
                  min={0}
                  value={draft.minimumStock || ""}
                  onChange={(event) => patch({ minimumStock: Number(event.target.value) || 0 })}
                />
                {mode === "create" ? (
                  <NumberField
                    id="hw-initial"
                    name="initialStock"
                    label="Stock actuel (facultatif)"
                    min={0}
                    step={draft.fractionable ? "0.1" : "1"}
                    value={draft.initialStock || ""}
                    onChange={(event) => patch({ initialStock: Number(event.target.value) || 0 })}
                  />
                ) : null}
              </Section>

              <Section
                title="Ce produit peut-il être vendu ou acheté en gros ?"
                hint="Ex. carton de 50 ampoules, sac de ciment…"
              >
                <YesNo
                  yes={hasWholesale}
                  onChange={(yes) => setUnits(yes ? [emptyPack("carton")] : [])}
                />
                {hasWholesale && pack ? (
                  <div className="grid gap-2 rounded-xl bg-slate-50 p-2.5">
                    <SelectField
                      id="hw-pack-name"
                      name="packName"
                      label="Type de conditionnement"
                      value={
                        HARDWARE_WHOLESALE_PACKS.includes(
                          pack.name as (typeof HARDWARE_WHOLESALE_PACKS)[number],
                        )
                          ? pack.name
                          : "carton"
                      }
                      onChange={(event) =>
                        setUnits([{ ...pack, name: event.target.value }])
                      }
                    >
                      {HARDWARE_WHOLESALE_PACKS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </SelectField>
                    <NumberField
                      id="hw-pack-qty"
                      name="containsQty"
                      label={`1 ${pack.name} contient combien de ${stockUnit}s ?`}
                      min={2}
                      value={pack.containsQty || ""}
                      onChange={(event) =>
                        setUnits([{ ...pack, containsQty: Number(event.target.value) || 0 }])
                      }
                    />
                    <PriceField
                      id="hw-pack-price"
                      name="packSell"
                      label={`Prix de vente du ${pack.name}`}
                      value={pack.sellingPrice || ""}
                      onChange={(event) =>
                        setUnits([{ ...pack, sellingPrice: Number(event.target.value) || 0 }])
                      }
                    />
                  </div>
                ) : null}
              </Section>

              <Section
                title="Vente au détail autorisée ?"
                hint="Le client donne un montant (ex. 500 F) : FasoBar calcule la quantité de stock."
              >
                <YesNo
                  yes={draft.fractionable}
                  onChange={(yes) => {
                    patch({
                      fractionable: yes,
                      fractionPrecision: 0.1,
                      units: pricedUnits(stockUnit, selling, packs, yes),
                    });
                  }}
                />
              </Section>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading || isPending}
            onClick={handleSave}
            className="inline-flex h-12 min-h-12 flex-[1.4] items-center justify-center rounded-xl bg-emerald-600 text-[14px] font-semibold text-white disabled:opacity-60"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  );
}
