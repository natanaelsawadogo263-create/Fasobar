"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { AlertMessage } from "@/components/auth/alert-message";
import { ProductImageField, type ProductImageAssets } from "@/components/products/product-image-field";
import {
  NumberField,
  PriceField,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/ui/form-controls";
import {
  listHardwareCatalogMetaAction,
  loadHardwareProductDraftAction,
  saveHardwareProductAction,
} from "@/app/(protected)/application/produits/hardware-catalog-actions";
import type { CategoryOption } from "@/lib/products/types";
import { HARDWARE_STOCK_UNIT_SUGGESTIONS } from "@/lib/hardware/product-catalog-constants";
import type {
  HardwareBrand,
  HardwareProductDraft,
  HardwareUnitLevel,
  HardwareVariantDraft,
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

function basePurchase(units: HardwareUnitLevel[]): number {
  return units.find((unit) => unit.isBase || unit.clientId === "base")?.purchasePrice ?? 0;
}

function emptyPack(): HardwareUnitLevel {
  return {
    clientId: crypto.randomUUID(),
    name: "carton",
    parentClientId: "base",
    containsQty: 12,
    isBase: false,
    purchasable: true,
    sellable: true,
    purchasePrice: 0,
    sellingPrice: 0,
  };
}

function pricedUnits(
  stockUnit: string,
  sellingPrice: number,
  purchasePrice: number,
  packs: HardwareUnitLevel[],
): HardwareUnitLevel[] {
  const base: HardwareUnitLevel = {
    ...emptyHardwareUnits(stockUnit)[0],
    sellable: true,
    sellingPrice,
    purchasable: purchasePrice > 0,
    purchasePrice: purchasePrice > 0 ? purchasePrice : 0,
  };
  return [
    base,
    ...packs.map((pack) => ({
      ...pack,
      parentClientId: "base",
      isBase: false,
      sellable: pack.sellingPrice > 0,
      purchasable: pack.purchasePrice > 0,
    })),
  ];
}

function emptySize(stockUnit: string, packs: HardwareUnitLevel[] = []): HardwareVariantDraft {
  return {
    clientId: crypto.randomUUID(),
    attributeId: "",
    attributeValue: "",
    internalRef: "",
    minimumStock: 0,
    units: pricedUnits(stockUnit, 0, 0, packs.map((pack) => ({ ...pack, clientId: crypto.randomUUID() }))),
  };
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

function PacksEditor({
  units,
  stockUnit,
  onChange,
}: {
  units: HardwareUnitLevel[];
  stockUnit: string;
  onChange: (units: HardwareUnitLevel[]) => void;
}) {
  const packs = extraPacks(units);
  const selling = baseSelling(units);
  const purchase = basePurchase(units);

  function setPacks(nextPacks: HardwareUnitLevel[]) {
    onChange(pricedUnits(stockUnit, selling, purchase, nextPacks));
  }

  return (
    <div className="space-y-2">
      {packs.map((pack) => (
        <div key={pack.clientId} className="grid gap-2 rounded-xl bg-slate-50 p-2.5">
          <div className="flex items-start gap-2">
            <TextField
              id={`pack-name-${pack.clientId}`}
              name="packName"
              label="Nom du lot"
              placeholder="Carton, bobine, boîte…"
              className="min-w-0 flex-1"
              value={pack.name}
              onChange={(event) =>
                setPacks(
                  packs.map((item) =>
                    item.clientId === pack.clientId ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() => setPacks(packs.filter((item) => item.clientId !== pack.clientId))}
              className="mt-6 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500"
              aria-label="Retirer le lot"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <NumberField
            id={`pack-qty-${pack.clientId}`}
            name="containsQty"
            label={`Combien de « ${stockUnit} » dans ce lot`}
            min={2}
            value={pack.containsQty || ""}
            onChange={(event) =>
              setPacks(
                packs.map((item) =>
                  item.clientId === pack.clientId
                    ? { ...item, containsQty: Number(event.target.value) || 0 }
                    : item,
                ),
              )
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <PriceField
              id={`pack-sell-${pack.clientId}`}
              name="packSell"
              label="Vente du lot"
              value={pack.sellingPrice || ""}
              onChange={(event) =>
                setPacks(
                  packs.map((item) =>
                    item.clientId === pack.clientId
                      ? { ...item, sellingPrice: Number(event.target.value) || 0 }
                      : item,
                  ),
                )
              }
            />
            <PriceField
              id={`pack-buy-${pack.clientId}`}
              name="packBuy"
              label="Achat du lot"
              value={pack.purchasePrice || ""}
              onChange={(event) =>
                setPacks(
                  packs.map((item) =>
                    item.clientId === pack.clientId
                      ? { ...item, purchasePrice: Number(event.target.value) || 0 }
                      : item,
                  ),
                )
              }
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setPacks([...packs, emptyPack()])}
        className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-[13px] font-semibold text-slate-700"
      >
        <Plus className="h-4 w-4" />
        Ajouter un lot
      </button>
    </div>
  );
}

function PriceAndLots({
  units,
  stockUnit,
  onChange,
}: {
  units: HardwareUnitLevel[];
  stockUnit: string;
  onChange: (units: HardwareUnitLevel[]) => void;
}) {
  const packs = extraPacks(units);
  const selling = baseSelling(units);
  const purchase = basePurchase(units);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <PriceField
          id={`sell-${units[0]?.clientId ?? "base"}`}
          name="sellingPrice"
          label={`Vente / ${stockUnit}`}
          required
          value={selling || ""}
          onChange={(event) =>
            onChange(pricedUnits(stockUnit, Number(event.target.value) || 0, purchase, packs))
          }
        />
        <PriceField
          id={`buy-${units[0]?.clientId ?? "base"}`}
          name="purchasePrice"
          label={`Achat / ${stockUnit}`}
          value={purchase || ""}
          onChange={(event) =>
            onChange(pricedUnits(stockUnit, selling, Number(event.target.value) || 0, packs))
          }
        />
      </div>
      <ToggleField
        id={`lots-${units[0]?.clientId ?? "base"}`}
        label="On vend aussi en lot"
        description="Carton, bobine, boîte… en plus de l’unité."
        checked={packs.length > 0}
        onChange={(checked) =>
          onChange(pricedUnits(stockUnit, selling, purchase, checked ? [emptyPack()] : []))
        }
      />
      {packs.length > 0 ? <PacksEditor units={units} stockUnit={stockUnit} onChange={onChange} /> : null}
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
  const [hasSizes, setHasSizes] = useState(false);
  const [brands, setBrands] = useState<HardwareBrand[]>([]);
  const [imageAssets, setImageAssets] = useState<ProductImageAssets>({ file: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meta = await listHardwareCatalogMetaAction();
      if (cancelled) return;
      if (!meta.error) setBrands(meta.brands);
      if (mode === "edit" && productId) {
        const loaded = await loadHardwareProductDraftAction(productId);
        if (!cancelled && loaded.draft) {
          const next = loaded.draft;
          const known = isKnownUnit(next.stockUnit);
          setDraft({
            ...next,
            stockUnit: known ? next.stockUnit : "__custom__",
            customStockUnit: known ? "" : next.customStockUnit || next.stockUnit,
          });
          setHasSizes(Boolean(next.useVariants && next.variants.length > 0));
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

  function toggleSizes(next: boolean) {
    setHasSizes(next);
    setError(null);
    if (next) {
      patch({
        useVariants: true,
        variants:
          draft.variants.length > 0
            ? draft.variants
            : [emptySize(stockUnit, extraPacks(draft.units))],
      });
      return;
    }
    const first = draft.variants[0];
    patch({
      useVariants: false,
      variants: [],
      units: first ? first.units : draft.units,
    });
  }

  function handleSave() {
    if (draft.name.trim().length < 2) {
      setError("Indiquez le nom du produit.");
      return;
    }
    if (!draft.categoryId || draft.categoryId === "__new__") {
      if (draft.newCategoryName.trim().length < 2) {
        setError("Choisissez une catégorie.");
        return;
      }
    }
    if (!stockUnit) {
      setError("Indiquez comment on compte (pièce, sac, mètre…).");
      return;
    }

    if (hasSizes) {
      const sizes = draft.variants.filter((item) => item.attributeValue.trim());
      if (sizes.length === 0) {
        setError("Ajoutez au moins une taille (ex. 2,5 mm² ou 5 L).");
        return;
      }
      if (sizes.some((item) => baseSelling(item.units) <= 0)) {
        setError("Chaque taille doit avoir un prix de vente.");
        return;
      }
      for (const size of sizes) {
        for (const pack of extraPacks(size.units)) {
          if (!pack.name.trim() || !(pack.containsQty > 1)) {
            setError(`Lot incomplet pour « ${size.attributeValue} ».`);
            return;
          }
        }
      }
    } else if (baseSelling(draft.units) <= 0) {
      setError("Indiquez le prix de vente.");
      return;
    } else {
      for (const pack of extraPacks(draft.units)) {
        if (!pack.name.trim() || !(pack.containsQty > 1)) {
          setError("Nommez le lot et indiquez combien d’unités il contient.");
          return;
        }
      }
    }

    startTransition(async () => {
      const toSave: HardwareProductDraft = {
        ...draft,
        fractionable: draft.fractionable,
        fractionPrecision: draft.fractionable ? draft.fractionPrecision || 0.1 : draft.fractionPrecision,
        useVariants: hasSizes,
        variants: hasSizes
          ? draft.variants
              .filter((item) => item.attributeValue.trim())
              .map((item) => ({
                ...item,
                units: pricedUnits(
                  stockUnit,
                  baseSelling(item.units),
                  basePurchase(item.units),
                  extraPacks(item.units),
                ),
              }))
          : [],
        units: hasSizes
          ? emptyHardwareUnits(stockUnit)
          : pricedUnits(
              stockUnit,
              baseSelling(draft.units),
              basePurchase(draft.units),
              extraPacks(draft.units),
            ),
      };
      const formData = new FormData();
      formData.set("draft", JSON.stringify(toSave));
      if (imageAssets.file) formData.set("imageOriginal", imageAssets.file);
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
            <p className="mt-0.5 text-[12px] text-slate-500">Comme au magasin : un article, ses tailles, ses prix.</p>
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
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : (
            <div className="grid gap-3">
              <Section title="Le produit" hint="Ce que le client voit et cherche.">
                <TextField
                  id="hw-name"
                  name="name"
                  label="Nom"
                  required
                  placeholder="Ex : Câble électrique, Ciment 50 kg"
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
                <SelectField
                  id="hw-brand"
                  name="brandId"
                  label="Marque"
                  value={draft.brandId === "__new__" ? "__new__" : draft.brandId}
                  onChange={(event) => patch({ brandId: event.target.value, newBrandName: "" })}
                >
                  <option value="">Aucune</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                  <option value="__new__">+ Nouvelle marque</option>
                </SelectField>
                {draft.brandId === "__new__" ? (
                  <TextField
                    id="hw-new-brand"
                    name="newBrandName"
                    label="Nom de la marque"
                    placeholder="Ex : Nexans, Dangote"
                    value={draft.newBrandName}
                    onChange={(event) =>
                      patch({ newBrandName: event.target.value, brandId: "__new__" })
                    }
                  />
                ) : null}
                <ProductImageField compact existingUrl={draft.imageUrl} onAssetsChange={setImageAssets} />
              </Section>

              <Section
                title="Comment on compte"
                hint="Pièce, sac, mètre, kilo… C’est l’unité du stock et de la caisse."
              >
                <SelectField
                  id="hw-unit"
                  name="stockUnit"
                  label="Unité"
                  value={isKnownUnit(draft.stockUnit) ? draft.stockUnit : "__custom__"}
                  onChange={(event) => {
                    const value = event.target.value;
                    patch({
                      stockUnit: value,
                      customStockUnit: value === "__custom__" ? draft.customStockUnit : "",
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
                      patch({ stockUnit: "__custom__", customStockUnit: event.target.value })
                    }
                  />
                ) : null}
                <ToggleField
                  id="hw-cut"
                  label="On peut vendre une partie"
                  description="Couper au mètre, peser au kilo, servir au litre."
                  checked={draft.fractionable}
                  onChange={(checked) =>
                    patch({ fractionable: checked, fractionPrecision: checked ? 0.1 : draft.fractionPrecision })
                  }
                />
              </Section>

              <Section
                title="Tailles et prix"
                hint="Câble 1,5 / 2,5 mm², peinture 1 L / 5 L, PVC 20 / 25… Cochez seulement si c’est le même article."
              >
                <ToggleField
                  id="hw-sizes"
                  label="Plusieurs tailles"
                  description="Sinon, un seul prix ci-dessous."
                  checked={hasSizes}
                  onChange={toggleSizes}
                />

                {hasSizes ? (
                  <div className="space-y-2">
                    {draft.variants.map((variant, index) => (
                      <div key={variant.clientId} className="grid gap-3 rounded-xl border border-slate-200 p-2.5">
                        <div className="flex items-start gap-2">
                          <TextField
                            id={`size-${variant.clientId}`}
                            name="size"
                            label={`Taille ${index + 1}`}
                            placeholder="Ex : 2,5 mm²"
                            className="min-w-0 flex-1"
                            value={variant.attributeValue}
                            onChange={(event) =>
                              patch({
                                variants: draft.variants.map((item) =>
                                  item.clientId === variant.clientId
                                    ? { ...item, attributeValue: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                variants: draft.variants.filter((item) => item.clientId !== variant.clientId),
                              })
                            }
                            className="mt-6 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500"
                            aria-label="Retirer la taille"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <PriceAndLots
                          units={variant.units}
                          stockUnit={stockUnit}
                          onChange={(units) =>
                            patch({
                              variants: draft.variants.map((item) =>
                                item.clientId === variant.clientId ? { ...item, units } : item,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          variants: [
                            ...draft.variants,
                            emptySize(stockUnit, extraPacks(draft.variants[0]?.units ?? [])),
                          ],
                        })
                      }
                      className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter une taille
                    </button>
                  </div>
                ) : (
                  <PriceAndLots
                    units={draft.units}
                    stockUnit={stockUnit}
                    onChange={(units) => patch({ units })}
                  />
                )}
              </Section>

              <Section title="Alerte stock">
                <NumberField
                  id="hw-min"
                  name="minimumStock"
                  label="Quantité minimum"
                  hint={`En « ${stockUnit} ». On prévient quand le stock descend trop bas.`}
                  min={0}
                  value={draft.minimumStock || ""}
                  onChange={(event) => patch({ minimumStock: Number(event.target.value) || 0 })}
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
