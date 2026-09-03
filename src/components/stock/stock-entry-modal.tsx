"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Package, X } from "lucide-react";

import { ModalFooter } from "@/components/ui/modal-footer";
import { StockArticleSearch } from "@/components/stock/stock-article-search";
import {
  FormSection,
  NumberField,
  PriceField,
  SelectField,
  TextField,
} from "@/components/ui/form-controls";
import {
  BAR_PACKAGING_LABELS,
  formatProductUnitDisplay,
} from "@/lib/products/constants";
import type { BarPackagingUnit } from "@/lib/products/schemas";
import type { ProductPackaging } from "@/lib/products/types";
import {
  formatPriceXof,
  getPurchasePresetsForDepartment,
  PRODUCT_UNIT_LABELS,
} from "@/lib/stock/constants";
import type { SupplierOption, StockListItem } from "@/lib/stock/types";

const EMPTY_PRODUCT_UNITS: ProductPackaging[] = [];

function unitWord(label: string, count: number): string {
  const base = label.toLowerCase();
  return count > 1 ? `${base}s` : base;
}

type StockEntryModalProps = {
  stockItems: StockListItem[];
  suppliers: SupplierOption[];
  /** Conditionnements issus de la création produit (casier / carton / sachet). */
  packagingsByProduct?: Record<string, ProductPackaging[]>;
  preselectedItemId?: string | null;
  formError: string | null;
  isPending?: boolean;
  /** Approvisionnements : uniquement les boissons (bar). */
  drinksOnly?: boolean;
  /** Magasin commerce : entrée en unités, sans casier. */
  simpleEntry?: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
};

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function resolveInitialStockItemId(
  stockItems: StockListItem[],
  preselectedItemId?: string | null,
): string {
  if (preselectedItemId && stockItems.some((item) => item.id === preselectedItemId)) {
    return preselectedItemId;
  }
  return stockItems[0]?.id ?? "";
}

function packagingFormatLabel(unit: string): string {
  return (
    BAR_PACKAGING_LABELS[unit as BarPackagingUnit] ??
    PRODUCT_UNIT_LABELS[unit as keyof typeof PRODUCT_UNIT_LABELS] ??
    unit
  );
}

function purchaseUnitLabel(packaging: ProductPackaging): string {
  const raw = packaging.name?.trim() || packaging.packagingUnit;
  return packagingFormatLabel(raw);
}

function purchaseConversionHint(packaging: ProductPackaging): string | null {
  const pack = purchaseUnitLabel(packaging);
  const base = packaging.baseUnit?.trim() || "";
  const factor = Number(packaging.conversionFactor) || 1;
  if (factor <= 1) return null;
  if (!base || base.toLowerCase() === pack.toLowerCase()) return null;
  return `1 ${pack} = ${factor} ${unitWord(base, factor)}`;
}

function packagingCountLabel(unit: string, count: number): string {
  const base = packagingFormatLabel(unit).toLowerCase();
  return count > 1 ? `${base}s` : base;
}

export function StockEntryModal({
  stockItems,
  suppliers,
  packagingsByProduct = {},
  preselectedItemId,
  formError,
  isPending = false,
  drinksOnly = false,
  simpleEntry = false,
  onClose,
  onSubmit,
}: StockEntryModalProps) {
  const mounted = useIsClient();
  const [stockItemId, setStockItemId] = useState(() =>
    resolveInitialStockItemId(stockItems, preselectedItemId),
  );
  const [packagingId, setPackagingId] = useState("");
  const [purchasedQuantity, setPurchasedQuantity] = useState("1");
  const [conversionFactor, setConversionFactor] = useState("1");
  const [packPrice, setPackPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedItem = stockItems.find((item) => item.id === stockItemId) ?? stockItems[0];
  const isKitchen = !drinksOnly && selectedItem?.departmentCode === "KITCHEN";
  const isBarItem = drinksOnly || selectedItem?.departmentCode === "BAR";

  const productId = selectedItem?.productId;
  const productUnits = productId
    ? (packagingsByProduct[productId] ?? EMPTY_PRODUCT_UNITS)
    : EMPTY_PRODUCT_UNITS;

  const useCommerceUnits = productUnits.length > 0;
  const isSimple = simpleEntry && !useCommerceUnits;

  const resolvedPackagingId =
    productUnits.length === 0
      ? ""
      : packagingId && productUnits.some((unit) => unit.id === packagingId)
        ? packagingId
        : (productUnits[0]?.id ?? "");

  const selectedPackaging =
    productUnits.find((unit) => unit.id === resolvedPackagingId) ?? null;

  const unitLabel = formatProductUnitDisplay(
    selectedItem?.unit ?? "PIECE",
    selectedItem?.stockUnitLabel,
  );
  const packagingFormat = selectedPackaging
    ? purchaseUnitLabel(selectedPackaging)
    : null;
  const conversionHint = selectedPackaging
    ? purchaseConversionHint(selectedPackaging)
    : null;
  const stockUnitName =
    selectedPackaging?.baseUnit?.trim() || unitLabel;
  const packCount = Number(purchasedQuantity) || 0;
  const packagingQtyLabel = selectedPackaging
    ? packagingCountLabel(selectedPackaging.packagingUnit, packCount)
    : null;
  const unitsPerPack =
    selectedPackaging?.conversionFactor ?? (Number(conversionFactor) || 1);
  const stockQuantity =
    Math.round(packCount * unitsPerPack * 1000) / 1000;
  const packPriceNumber = packPrice.trim() === "" ? null : Number(packPrice);
  const totalCost =
    packPriceNumber !== null && Number.isFinite(packPriceNumber)
      ? Math.round(packCount * packPriceNumber)
      : null;

  const purchasePresets = getPurchasePresetsForDepartment(
    selectedItem?.departmentCode === "KITCHEN" ? "KITCHEN" : "BAR",
  );
  const activeSuppliers = suppliers.filter((supplier) => supplier.active);

  function handleStockItemChange(nextId: string) {
    setStockItemId(nextId);
    setPackagingId("");
    setPurchasedQuantity("1");
    setPackPrice("");
    setLocalError(null);
    const nextItem = stockItems.find((item) => item.id === nextId);
    if (nextItem?.departmentCode === "KITCHEN") {
      setConversionFactor("1");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!stockItemId) {
      setLocalError("Choisissez un produit.");
      return;
    }

    if (activeSuppliers.length === 0) {
      setLocalError("Créez d'abord un fournisseur, puis enregistrez l'entrée.");
      return;
    }

    if (!supplierId) {
      setLocalError("Choisissez le fournisseur.");
      return;
    }

    if (isBarItem && !isSimple && !selectedPackaging) {
      setLocalError(
        "Ce produit n'a pas de format (casier / carton / sachet). Modifiez-le dans Produits.",
      );
      return;
    }

    const purchased = Number(purchasedQuantity);
    const factor = selectedPackaging
      ? selectedPackaging.conversionFactor
      : Number(conversionFactor);

    if (!Number.isFinite(purchased) || purchased <= 0) {
      setLocalError(
        selectedPackaging
          ? `Indiquez le nombre de ${packagingFormatLabel(selectedPackaging.packagingUnit).toLowerCase()}s.`
          : "La quantité doit être strictement positive.",
      );
      return;
    }

    if (!Number.isFinite(factor) || factor <= 0) {
      setLocalError("Le coefficient de conversion doit être strictement positif.");
      return;
    }

    if (packPrice.trim() === "" || !Number.isFinite(Number(packPrice)) || Number(packPrice) < 0) {
      setLocalError(
        selectedPackaging
          ? `Indiquez le prix unitaire du ${packagingFormatLabel(selectedPackaging.packagingUnit).toLowerCase()}.`
          : "Indiquez le prix d'achat.",
      );
      return;
    }

    const formData = new FormData();
    formData.set("stockItemId", stockItemId);
    formData.set("movementType", "PURCHASE");
    formData.set("purchasedQuantity", String(purchased));
    formData.set("conversionFactor", String(factor));

    const packagingCost = Number(packPrice);
    if (selectedPackaging) {
      // Prix du paquet → coût unitaire stock (F CFA entier)
      formData.set(
        "unitCost",
        String(Math.round(packagingCost / factor)),
      );
    } else {
      formData.set("unitCost", String(Math.round(packagingCost)));
    }

    formData.set("supplierId", supplierId);
    if (reference.trim()) {
      formData.set("reference", reference.trim());
    }
    const autoReason =
      selectedPackaging && !reason.trim()
        ? `Entrée ${purchased} ${packagingCountLabel(selectedPackaging.packagingUnit, purchased)}${
            conversionHint ? ` (${conversionHint})` : ""
          }`
        : reason.trim();
    if (autoReason) {
      formData.set("reason", autoReason);
    }
    if (entryDate) {
      formData.set("entryDate", entryDate);
    }

    onSubmit(formData);
  }

  const displayError = localError ?? formError;
  const cannotSubmit =
    activeSuppliers.length === 0 ||
    (isBarItem && !isSimple && productUnits.length === 0 && Boolean(selectedItem));

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-entry-title"
        className="flex max-h-[min(92vh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <h2
                id="stock-entry-title"
                className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
              >
                {drinksOnly ? "Nouvelle entrée" : "Nouvelle entrée stock"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isBarItem
                  ? "Approvisionnement fournisseur — les infos produit sont reprises automatiquement."
                  : "Enregistrez une livraison fournisseur."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-6">
              {displayError ? (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {displayError}
                </p>
              ) : null}

              {stockItems.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  {isSimple
                    ? "Aucun article de stock. Créez d'abord un article dans le catalogue."
                    : drinksOnly
                    ? "Aucun produit bar. Créez-en un dans Produits (avec casier, carton ou sachet)."
                    : "Aucun article de stock. Créez d'abord un produit."}
                </div>
              ) : isBarItem ? (
                <>
                  <FormSection
                    title="Produit"
                    description={
                      isSimple
                        ? "Choisissez l’article à réapprovisionner."
                        : "Le conditionnement (pièce, boîte, carton…) est défini sur le produit."
                    }
                  >
                    <StockArticleSearch
                      items={stockItems}
                      value={stockItemId}
                      onChange={handleStockItemChange}
                      label="Article"
                    />

                    {selectedItem && productUnits.length === 0 && !isSimple ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        « {selectedItem.name} » n&apos;a pas de conditionnement (casier,
                        carton ou sachet). Ouvrez le produit dans{" "}
                        <strong>Produits</strong>, définissez le format, puis revenez ici.
                      </div>
                    ) : null}

                    {selectedPackaging ? (
                      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80">
                          <Package className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {packagingFormat}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {conversionHint ??
                              "Unité de réception — saisissez combien vous avez reçu."}
                          </p>
                          {productUnits.length > 1 ? (
                            <SelectField
                              id="packagingId"
                              name="packagingId"
                              label="Autre format"
                              className="mt-3"
                              value={selectedPackaging.id}
                              onChange={(event) => setPackagingId(event.target.value)}
                            >
                              {productUnits.map((packaging) => {
                                const factor = Number(packaging.conversionFactor) || 1;
                                const hint = purchaseConversionHint(packaging);
                                const kind = factor > 1 ? "Gros" : "Unité";
                                return (
                                  <option key={packaging.id} value={packaging.id}>
                                    {kind} · {purchaseUnitLabel(packaging)}
                                    {hint ? ` · ${hint}` : ""}
                                  </option>
                                );
                              })}
                            </SelectField>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </FormSection>

                  <FormSection
                    title="Livraison"
                    description="Fournisseur et date de réception."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SelectField
                        id="supplierId"
                        name="supplierId"
                        label="Fournisseur"
                        value={supplierId}
                        onChange={(event) => setSupplierId(event.target.value)}
                        required
                        disabled={activeSuppliers.length === 0}
                      >
                        <option value="">
                          {activeSuppliers.length === 0
                            ? "Aucun fournisseur disponible"
                            : "Sélectionner un fournisseur"}
                        </option>
                        {activeSuppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                            {supplier.phone ? ` · ${supplier.phone}` : ""}
                          </option>
                        ))}
                      </SelectField>
                      <TextField
                        id="entryDate"
                        name="entryDate"
                        label="Date de réception"
                        type="date"
                        value={entryDate}
                        onChange={(event) => setEntryDate(event.target.value)}
                      />
                    </div>

                    {activeSuppliers.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        Créez d&apos;abord un fournisseur dans Approvisionnements.
                      </div>
                    ) : null}
                  </FormSection>

                  <FormSection
                    title="Quantité et prix"
                    description={
                      packagingFormat
                        ? `Indiquez le nombre de ${packagingFormat.toLowerCase()}s reçus et le prix d'achat de chaque ${packagingFormat.toLowerCase()}.`
                        : "Indiquez la quantité reçue et le prix d'achat."
                    }
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <NumberField
                        id="purchasedQuantity"
                        name="purchasedQuantity"
                        label={
                          packagingFormat
                            ? `Quantité (${packagingFormat.toLowerCase()}s)`
                            : "Quantité"
                        }
                        value={purchasedQuantity}
                        onChange={(event) => setPurchasedQuantity(event.target.value)}
                        min={0.001}
                        step="any"
                        required
                        disabled={!selectedPackaging}
                      />
                      <PriceField
                        id="packPrice"
                        name="packPrice"
                        label={
                          packagingFormat
                            ? `Prix / ${packagingFormat.toLowerCase()}`
                            : "Prix unitaire"
                        }
                        value={packPrice}
                        onChange={(event) => setPackPrice(event.target.value)}
                        min={0}
                        step="1"
                        required
                        disabled={!selectedPackaging}
                      />
                    </div>

                    {selectedPackaging ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Récapitulatif
                          </p>
                        </div>
                        <dl className="divide-y divide-slate-100 text-sm">
                          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                            <dt className="text-slate-500">Conditionnement</dt>
                            <dd className="font-medium text-slate-900">
                              {packagingFormat}
                              {conversionHint ? ` · ${conversionHint}` : ""}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                            <dt className="text-slate-500">Entrée</dt>
                            <dd className="font-medium text-slate-900">
                              {packCount || 0} {packagingQtyLabel}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                            <dt className="text-slate-500">Stock ajouté</dt>
                            <dd className="font-semibold text-emerald-700">
                              {stockQuantity} {unitWord(stockUnitName, stockQuantity)} seront
                              ajoutées au stock.
                            </dd>
                          </div>
                          {totalCost !== null ? (
                            <div className="flex items-center justify-between gap-4 bg-slate-50/80 px-4 py-3">
                              <dt className="font-medium text-slate-700">Montant total</dt>
                              <dd className="text-base font-semibold tabular-nums text-slate-900">
                                {formatPriceXof(totalCost)}
                              </dd>
                            </div>
                          ) : (
                            <div className="px-4 py-2.5 text-xs text-slate-400">
                              Le montant total s&apos;affiche dès que le prix est renseigné.
                            </div>
                          )}
                        </dl>
                      </div>
                    ) : null}
                  </FormSection>
                </>
              ) : (
                <>
                  <FormSection
                    title="Article"
                    description="Choisissez une matière première cuisine à réapprovisionner."
                  >
                    <StockArticleSearch
                      items={stockItems}
                      value={stockItemId}
                      onChange={handleStockItemChange}
                      label="Article de stock"
                      optionLabel={(item) =>
                        isSimple
                          ? item.name
                          : `${item.departmentCode === "KITCHEN" ? "Cuisine · " : "Bar · "}${item.name}`
                      }
                    />

                    {isKitchen ? (
                      <p className="rounded-lg border border-orange-100 bg-orange-50/80 px-3 py-2 text-[12px] text-orange-950">
                        Les plats vendus ne sont pas du stock cuisine. Ici : sacs, huile,
                        viandes, légumes et autres denrées.
                      </p>
                    ) : null}

                    <SelectField
                      id="supplierId"
                      name="supplierId"
                      label="Fournisseur"
                      value={supplierId}
                      onChange={(event) => setSupplierId(event.target.value)}
                      required
                      disabled={activeSuppliers.length === 0}
                    >
                      <option value="">
                        {activeSuppliers.length === 0
                          ? "Aucun fournisseur actif"
                          : "Choisir un fournisseur"}
                      </option>
                      {activeSuppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                          {supplier.phone ? ` · ${supplier.phone}` : ""}
                        </option>
                      ))}
                    </SelectField>
                  </FormSection>

                  <FormSection
                    title="Quantités"
                    description="Ex. 2 sacs de riz × 25 kg, ou 1 bidon d'huile × 20 L."
                  >
                    <div className="flex flex-wrap gap-2">
                      {purchasePresets.map(([key, preset]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setConversionFactor(String(preset.factor))}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 active:bg-emerald-200"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <NumberField
                        id="purchasedQuantity"
                        name="purchasedQuantity"
                        label="Quantité achetée (sacs, bidons…)"
                        value={purchasedQuantity}
                        onChange={(event) => setPurchasedQuantity(event.target.value)}
                        min={0.001}
                        step="any"
                        required
                      />
                      <NumberField
                        id="conversionFactor"
                        name="conversionFactor"
                        label="Coefficient de conversion"
                        hint={`Multiplie la quantité achetée pour obtenir les ${unitLabel.toLowerCase()}s en stock.`}
                        value={conversionFactor}
                        onChange={(event) => setConversionFactor(event.target.value)}
                        min={0.001}
                        step="any"
                        required
                      />
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                      <p>
                        Quantité ajoutée au stock :{" "}
                        <span className="font-semibold">
                          {stockQuantity} {unitLabel.toLowerCase()}
                          {stockQuantity > 1 ? "s" : ""}
                        </span>
                      </p>
                      {totalCost !== null ? (
                        <p className="mt-1 font-semibold">
                          Coût total : {formatPriceXof(totalCost)}
                        </p>
                      ) : null}
                    </div>
                  </FormSection>

                  <FormSection title="Prix & détails">
                    <PriceField
                      id="packPrice"
                      name="packPrice"
                      label={`Prix unitaire (${unitLabel.toLowerCase()})`}
                      value={packPrice}
                      onChange={(event) => setPackPrice(event.target.value)}
                      min={0}
                      step="1"
                      required
                    />
                    <TextField
                      id="entryDate"
                      name="entryDate"
                      label="Date d'entrée"
                      type="date"
                      value={entryDate}
                      onChange={(event) => setEntryDate(event.target.value)}
                    />
                    <TextField
                      id="reference"
                      name="reference"
                      label="Référence (optionnel)"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="N° facture, BL…"
                    />
                    <TextField
                      id="reason"
                      name="reason"
                      label="Note (optionnel)"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </FormSection>
                </>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
            <ModalFooter
              onCancel={onClose}
              submitLabel="Enregistrer l'entrée"
              isPending={isPending}
              submitDisabled={cannotSubmit || stockItems.length === 0 || isPending}
            />
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
