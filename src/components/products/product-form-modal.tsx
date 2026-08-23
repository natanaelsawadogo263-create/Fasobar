"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AlertMessage } from "@/components/auth/alert-message";
import { ProductImageField, type ProductImageAssets } from "@/components/products/product-image-field";
import { ProductPackagingsEditor } from "@/components/products/product-packagings-editor";
import {
  FormSection,
  NumberField,
  PriceField,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/ui/form-controls";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  getCatalogFormProfile,
  shouldShowCatalogCategory,
  type CatalogFormProfile,
} from "@/lib/activity/catalog";
import { isHardwareActivity } from "@/lib/hardware/activity";
import {
  BAR_BASE_UNITS,
  BAR_PACKAGING_DEFAULT_UNITS,
  BAR_PACKAGING_LABELS,
  BAR_PACKAGING_UNITS,
  DEPARTMENT_LABELS,
  PRODUCT_UNIT_LABELS,
  PRODUCT_UNITS,
  SHOP_PACKAGING_DEFAULT_UNITS,
  SHOP_PACKAGING_UNITS,
  suggestedShopLot,
} from "@/lib/products/constants";
import type { CategoryOption, ProductListItem, ProductPackaging } from "@/lib/products/types";
import type { BarPackagingUnit, DepartmentCode, ProductUnit } from "@/lib/products/schemas";

const FORM_ID = "product-form";
const NEW_CATEGORY_VALUE = "__new__";

export type ProductFormState = {
  name: string;
  departmentCode: DepartmentCode;
  categoryId: string;
  sellingPrice: number;
  unit: (typeof PRODUCT_UNITS)[number];
  minimumStock: number;
  description: string;
  active: boolean;
  packagingUnit: BarPackagingUnit;
  unitsPerPack: number;
  lotSellingPrice: number;
  sku: string;
  barcode: string;
  purchasePrice: number;
  wholesalePrice: number;
  purchaseUnit: ProductUnit;
  unitsPerPurchase: number;
  discountMinQuantity: number;
  discountPercent: number;
  initialStock: number;
};

type ProductFormModalProps = {
  mode: "create" | "edit";
  formState: ProductFormState;
  categories: CategoryOption[];
  editingProduct: ProductListItem | null;
  packagings?: ProductPackaging[];
  formError: string | null;
  imageAssets: ProductImageAssets;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  onChange: (updater: (current: ProductFormState) => ProductFormState) => void;
  onImageAssetsChange: (assets: ProductImageAssets) => void;
  onPackagingsChanged?: () => void;
  isPending?: boolean;
  onClientValidationError?: (message: string) => void;
  allowedDepartments?: DepartmentCode[];
  catalogDepartmentLabel?: string;
  catalog?: CatalogFormProfile;
  activityCode?: string | null;
};

const HARDWARE_ARRIVAL_UNITS: ProductUnit[] = [
  "CARTON",
  "PACK",
  "SACHET",
  "BUNDLE",
  "JERRYCAN",
];

export function ProductFormModal({
  mode,
  formState,
  categories,
  editingProduct,
  packagings = [],
  formError,
  imageAssets,
  onClose,
  onSubmit,
  onChange,
  onImageAssetsChange,
  onPackagingsChanged,
  isPending = false,
  onClientValidationError = undefined,
  allowedDepartments,
  catalogDepartmentLabel,
  catalog: catalogProp,
  activityCode = null,
}: ProductFormModalProps) {
  const catalog = catalogProp ?? getCatalogFormProfile(null);
  const retail = catalog.kind === "retail";
  const hardware = isHardwareActivity(activityCode);
  const isCreate = mode === "create";
  const isBar = formState.departmentCode === "BAR";
  const shopLots = retail && catalog.showPackaging;
  const packagingChoices = shopLots ? SHOP_PACKAGING_UNITS : BAR_PACKAGING_UNITS;
  const [comesInLot, setComesInLot] = useState(formState.unitsPerPack > 1);
  const [newCategoryName, setNewCategoryName] = useState("");
  const creatingCategory = formState.categoryId === NEW_CATEGORY_VALUE;
  const departmentLabels: Record<DepartmentCode, string> = {
    ...DEPARTMENT_LABELS,
    ...(catalogDepartmentLabel ? { BAR: catalogDepartmentLabel } : {}),
  };
  const departmentChoices = allowedDepartments?.length
    ? Object.entries(departmentLabels).filter(([code]) =>
        allowedDepartments.includes(code as DepartmentCode),
      )
    : Object.entries(departmentLabels);
  const lockDepartment = departmentChoices.length === 1;
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setComesInLot(formState.unitsPerPack > 1);
  }, [mode, editingProduct?.id]);

  useEffect(() => {
    if (formError) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [formError]);

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) => {
        if (category.departmentCode !== formState.departmentCode) return false;
        return shouldShowCatalogCategory(category.name, catalog);
      }),
    [categories, formState.departmentCode, catalog],
  );

  const unitOptions = useMemo(() => {
    if (retail) {
      if ((catalog.units as readonly ProductUnit[]).includes(formState.unit)) {
        return catalog.units;
      }
      return [formState.unit, ...catalog.units];
    }
    if (!isBar) {
      return PRODUCT_UNITS;
    }
    if ((BAR_BASE_UNITS as readonly ProductUnit[]).includes(formState.unit)) {
      return [...BAR_BASE_UNITS];
    }
    return [formState.unit, ...BAR_BASE_UNITS];
  }, [formState.unit, isBar, retail, catalog.units]);
  const baseUnitLabel =
    PRODUCT_UNIT_LABELS[formState.unit] ?? formState.unit;
  const packagingLabel = BAR_PACKAGING_LABELS[formState.packagingUnit];

  return (
    <ModalShell
      formId={FORM_ID}
      compact
      title={isCreate ? catalog.addTitle : catalog.editTitle}
      onClose={isPending ? () => undefined : onClose}
      dismissible={!isPending}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending) {
          return;
        }

        const name = formState.name.trim();
        if (name.length < 2) {
          onClientValidationError?.("Indiquez le nom (au moins 2 caractères).");
          return;
        }
        if (creatingCategory) {
          if (newCategoryName.trim().length < 2) {
            onClientValidationError?.("Indiquez le nom de la nouvelle catégorie.");
            return;
          }
        } else if (!formState.categoryId) {
          onClientValidationError?.(
            retail
              ? "Sélectionnez une catégorie ou créez-en une."
              : "Sélectionnez une catégorie (ex. Bières, Sodas…).",
          );
          return;
        }
        if (
          !Number.isFinite(formState.sellingPrice) ||
          formState.sellingPrice <= 0
        ) {
          onClientValidationError?.("Indiquez un prix de vente (ex. 500).");
          return;
        }
        if (formState.minimumStock < 0 || Number.isNaN(formState.minimumStock)) {
          onClientValidationError?.("Le stock minimum doit être un nombre positif ou nul.");
          return;
        }
        if (
          isCreate &&
          (formState.initialStock < 0 || Number.isNaN(formState.initialStock))
        ) {
          onClientValidationError?.("Le stock actuel doit être un nombre positif ou nul.");
          return;
        }
        if (isBar && isCreate && !retail) {
          if (!formState.packagingUnit) {
            onClientValidationError?.(
              "Indiquez le format d'achat (casier, carton ou sachet).",
            );
            return;
          }
          if (!formState.unitsPerPack || formState.unitsPerPack < 1) {
            onClientValidationError?.(
              `Indiquez combien de ${baseUnitLabel.toLowerCase()}s contient le conditionnement.`,
            );
            return;
          }
        }
        if (shopLots && isCreate && comesInLot) {
          if (!formState.packagingUnit || formState.unitsPerPack < 2) {
            onClientValidationError?.(
              `Indiquez combien de ${baseUnitLabel.toLowerCase()}s contient le lot (ex. 5 bidons par carton).`,
            );
            return;
          }
          if (!Number.isFinite(formState.lotSellingPrice) || formState.lotSellingPrice <= 0) {
            onClientValidationError?.(
              `Indiquez le prix de vente du ${packagingLabel.toLowerCase()}.`,
            );
            return;
          }
        }

        const formData = new FormData();
        formData.set("name", name);
        formData.set("departmentCode", formState.departmentCode);
        formData.set("catalogKind", catalog.kind);
        if (creatingCategory) {
          formData.set("categoryId", "");
          formData.set("newCategoryName", newCategoryName.trim());
        } else {
          formData.set("categoryId", formState.categoryId);
        }
        formData.set("sellingPrice", String(formState.sellingPrice));
        formData.set("unit", formState.unit);
        formData.set("minimumStock", String(formState.minimumStock));
        if (isCreate && formState.initialStock > 0) {
          formData.set("initialStock", String(formState.initialStock));
        }
        formData.set("description", formState.description.trim());
        if (catalog.showBarcode) {
          formData.set("barcode", formState.barcode.trim());
        }
        if (catalog.showPurchasePrice) {
          formData.set("purchasePrice", String(formState.purchasePrice || 0));
        }
        formData.set("active", formState.active ? "on" : "off");
        if (isBar && isCreate && (!retail || catalog.showPackaging)) {
          if (
            formState.packagingUnit &&
            formState.unitsPerPack > 1 &&
            (!shopLots || comesInLot)
          ) {
            formData.set("packagingUnit", formState.packagingUnit);
            formData.set("unitsPerPack", String(formState.unitsPerPack));
            if (shopLots) {
              formData.set("lotSellingPrice", String(formState.lotSellingPrice));
            }
          }
        }
        if (hardware) {
          formData.set("purchasePrice", String(formState.purchasePrice || 0));
          formData.set("wholesalePrice", String(formState.wholesalePrice || 0));
          formData.set("purchaseUnit", formState.purchaseUnit);
          formData.set(
            "unitsPerPurchase",
            String(Math.max(1, formState.unitsPerPurchase || 1)),
          );
        }
        if (mode === "edit" && editingProduct) {
          formData.set("productId", editingProduct.id);
        }
        formData.set("imageSelection", "original");
        if (imageAssets.file) {
          formData.set("imageOriginal", imageAssets.file);
          formData.set("image", imageAssets.file);
        }
        onSubmit(formData);
      }}
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel={isCreate ? "Enregistrer" : "Mettre à jour"}
          isPending={isPending}
        />
      }
    >
      {formError ? (
        <div className="mb-3" id="product-form-error" ref={errorRef}>
          <AlertMessage message={formError} />
        </div>
      ) : null}

      <div className="space-y-3.5">
        {mode === "edit" && editingProduct ? (
          <input type="hidden" name="productId" value={editingProduct.id} />
        ) : null}

        {hardware ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextField
              id="name"
              name="name"
              label="Nom"
              required
              placeholder={catalog.namePlaceholder}
              value={formState.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              className="sm:col-span-2"
            />
            <input type="hidden" name="departmentCode" value={formState.departmentCode} />

            <SelectField
              id="categoryId"
              name="categoryId"
              label="Catégorie"
              required
              value={formState.categoryId}
              onChange={(event) => {
                const value = event.target.value;
                onChange((current) => ({ ...current, categoryId: value }));
                if (value !== NEW_CATEGORY_VALUE) {
                  setNewCategoryName("");
                }
              }}
            >
              <option value="">Choisir…</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value={NEW_CATEGORY_VALUE}>+ Nouvelle catégorie</option>
            </SelectField>

            <SelectField
              id="unit"
              name="unit"
              label="Unité de vente"
              required
              value={formState.unit}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  unit: event.target.value as ProductFormState["unit"],
                }))
              }
            >
              {unitOptions.map((unit) => (
                <option key={unit} value={unit}>
                  {PRODUCT_UNIT_LABELS[unit]}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="purchaseUnit"
              name="purchaseUnit"
              label="Arrivage (gros)"
              value={formState.purchaseUnit}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  purchaseUnit: event.target.value as ProductUnit,
                }))
              }
            >
              {HARDWARE_ARRIVAL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {PRODUCT_UNIT_LABELS[unit]}
                </option>
              ))}
            </SelectField>

            <NumberField
              id="unitsPerPurchase"
              name="unitsPerPurchase"
              label={`Pièces dans 1 ${(PRODUCT_UNIT_LABELS[formState.purchaseUnit] ?? "colis").toLowerCase()}`}
              min={1}
              step={1}
              placeholder="Ex : 20"
              value={formState.unitsPerPurchase || ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  unitsPerPurchase:
                    event.target.value === "" ? 0 : Number(event.target.value),
                }))
              }
            />
            {formState.unitsPerPurchase > 1 ? (
              <p className="sm:col-span-2 -mt-1 text-[12px] font-medium text-emerald-700">
                1 {(PRODUCT_UNIT_LABELS[formState.purchaseUnit] ?? "colis").toLowerCase()} ={" "}
                {formState.unitsPerPurchase}{" "}
                {(PRODUCT_UNIT_LABELS[formState.unit] ?? "pièce").toLowerCase()}
                {formState.unitsPerPurchase > 1 ? "s" : ""}. Vous vendez à l’unité.
              </p>
            ) : (
              <p className="sm:col-span-2 -mt-1 text-[11px] text-slate-500">
                Indiquez combien de {PRODUCT_UNIT_LABELS[formState.unit]?.toLowerCase() ?? "pièces"} il y a dans le carton / sac à l’arrivée. Mettez 1 si vous recevez déjà à l’unité.
              </p>
            )}

            {creatingCategory ? (
              <TextField
                id="newCategoryName"
                name="newCategoryName"
                label="Nom de la catégorie"
                required
                placeholder={
                  catalog.suggestedCategories[0]
                    ? `Ex : ${catalog.suggestedCategories[0]}`
                    : "Ex : Ciment"
                }
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                className="sm:col-span-2"
              />
            ) : null}

            <PriceField
              id="sellingPrice"
              name="sellingPrice"
              label="Prix de vente"
              placeholder="Ex : 6500"
              value={formState.sellingPrice === 0 ? "" : formState.sellingPrice}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  sellingPrice: event.target.value === "" ? 0 : Number(event.target.value),
                }))
              }
            />
            <PriceField
              id="purchasePrice"
              name="purchasePrice"
              label="Prix d’achat"
              min={0}
              placeholder="Optionnel"
              value={formState.purchasePrice || ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  purchasePrice: Number(event.target.value) || 0,
                }))
              }
            />
            <PriceField
              id="wholesalePrice"
              name="wholesalePrice"
              label="Prix gros"
              min={0}
              placeholder="Optionnel"
              value={formState.wholesalePrice || ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  wholesalePrice: Number(event.target.value) || 0,
                }))
              }
            />
            <NumberField
              id="minimumStock"
              name="minimumStock"
              label="Alerte stock"
              placeholder="0"
              value={formState.minimumStock === 0 ? "" : formState.minimumStock}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  minimumStock:
                    event.target.value === "" ? 0 : Number(event.target.value),
                }))
              }
            />
            {isCreate ? (
              <NumberField
                id="initialStock"
                name="initialStock"
                label="Stock actuel"
                hint={`Quantité déjà en magasin, en ${baseUnitLabel.toLowerCase()}s.`}
                min={0}
                placeholder="0"
                value={formState.initialStock === 0 ? "" : formState.initialStock}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    initialStock:
                      event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
              />
            ) : null}

            <div className="sm:col-span-2">
              <ProductImageField
                existingUrl={
                  editingProduct?.imageUrl ??
                  editingProduct?.imageOriginalUrl ??
                  editingProduct?.imageOptimizedUrl
                }
                onAssetsChange={onImageAssetsChange}
                compact
              />
            </div>

            {mode === "edit" ? (
              <div className="sm:col-span-2">
                <ToggleField
                  id="active"
                  name="active"
                  label="Article en vente"
                  checked={formState.active}
                  onChange={(active) => onChange((current) => ({ ...current, active }))}
                />
              </div>
            ) : (
              <input type="hidden" name="active" value={formState.active ? "on" : "off"} />
            )}
          </div>
        ) : (
          <>
        <FormSection title={retail ? "Article" : "Produit"} compact>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextField
              id="name"
              name="name"
              label={catalog.nameLabel}
              required
              placeholder={catalog.namePlaceholder}
              value={formState.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              className="sm:col-span-2"
            />

            {catalog.hideDepartment || lockDepartment ? (
              <input type="hidden" name="departmentCode" value={formState.departmentCode} />
            ) : null}

            {!catalog.hideDepartment && lockDepartment ? (
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-700">
                  {catalog.departmentLabel}
                </p>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-800">
                  {departmentLabels[formState.departmentCode]}
                </p>
              </div>
            ) : null}

            {!catalog.hideDepartment && !lockDepartment ? (
              <SelectField
                id="departmentCode"
                name="departmentCode"
                label={catalog.departmentLabel}
                required
                value={formState.departmentCode}
                onChange={(event) => {
                  const departmentCode = event.target.value as DepartmentCode;
                  onChange((current) => ({
                    ...current,
                    departmentCode,
                    categoryId: "",
                    unit: departmentCode === "BAR" ? catalog.defaultUnit : "PORTION",
                    packagingUnit: "CASE",
                    unitsPerPack: BAR_PACKAGING_DEFAULT_UNITS.CASE,
                    lotSellingPrice: 0,
                  }));
                  setNewCategoryName("");
                }}
              >
                {departmentChoices.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </SelectField>
            ) : null}

            <SelectField
              id="categoryId"
              name="categoryId"
              label="Catégorie"
              required
              value={formState.categoryId}
              onChange={(event) => {
                const value = event.target.value;
                onChange((current) => ({ ...current, categoryId: value }));
                if (value !== NEW_CATEGORY_VALUE) {
                  setNewCategoryName("");
                }
              }}
              className={catalog.hideDepartment ? "sm:col-span-2" : undefined}
            >
              <option value="">Choisir…</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value={NEW_CATEGORY_VALUE}>+ Nouvelle catégorie</option>
            </SelectField>

            {creatingCategory ? (
              <TextField
                id="newCategoryName"
                name="newCategoryName"
                label="Nom de la catégorie"
                required
                placeholder={
                  catalog.suggestedCategories[0]
                    ? `Ex : ${catalog.suggestedCategories[0]}`
                    : "Ex : Accessoires"
                }
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                className="sm:col-span-2"
              />
            ) : null}

            {catalog.showBarcode ? (
              <TextField
                id="barcode"
                name="barcode"
                label="Code-barres"
                placeholder="Scan ou saisie manuelle (optionnel)"
                inputMode="numeric"
                autoComplete="off"
                // La douchette USB émule un clavier : sans focus sur ce champ
                // dès l'ouverture, le scan ne va nulle part et le code
                // n'apparaît jamais dans la case.
                autoFocus
                value={formState.barcode}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    barcode: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  // La douchette envoie un Entrée après le code scanné — sans
                  // ça, elle soumettrait le formulaire produit en entier
                  // (encore vide) au lieu de simplement valider le scan.
                  if (event.key === "Enter") {
                    event.preventDefault();
                  }
                }}
                className="sm:col-span-2"
              />
            ) : null}

            {catalog.showReference ? (
              <TextField
                id="description"
                name="description"
                label={catalog.referenceLabel}
                placeholder={catalog.referencePlaceholder}
                value={formState.description}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="sm:col-span-2"
              />
            ) : null}

            {!creatingCategory && filteredCategories.length === 0 ? (
              <p className="sm:col-span-2 text-[11px] text-amber-700">
                Aucune catégorie pour l’instant — créez-en une ci-dessus.
              </p>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Prix & stock" compact>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <PriceField
              id="sellingPrice"
              name="sellingPrice"
              label={
                shopLots && comesInLot
                  ? `Prix / ${baseUnitLabel.toLowerCase()}`
                  : "Prix de vente"
              }
              placeholder="Ex : 1000"
              value={formState.sellingPrice === 0 ? "" : formState.sellingPrice}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  sellingPrice: event.target.value === "" ? 0 : Number(event.target.value),
                }))
              }
            />

            {isCreate && formState.departmentCode === "BAR" ? (
              <NumberField
                id="initialStock"
                name="initialStock"
                label="Stock actuel"
                hint={`Quantité déjà en stock, en ${baseUnitLabel.toLowerCase()}s.`}
                min={0}
                placeholder="0"
                value={formState.initialStock === 0 ? "" : formState.initialStock}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    initialStock:
                      event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
              />
            ) : null}

            {catalog.showPurchasePrice ? (
              <PriceField
                id="purchasePrice"
                name="purchasePrice"
                label="Prix d'achat"
                hint="Coût unitaire pour le calcul du bénéfice."
                min={0}
                placeholder="Ex : 3500"
                value={formState.purchasePrice === 0 ? "" : formState.purchasePrice}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    purchasePrice:
                      event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
              />
            ) : null}

            <NumberField
              id="minimumStock"
              name="minimumStock"
              label="Stock minimum"
              required
              placeholder="0"
              value={formState.minimumStock === 0 ? "" : formState.minimumStock}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  minimumStock:
                    event.target.value === "" ? 0 : Number(event.target.value),
                }))
              }
            />

            <div className="sm:col-span-2">
              {isBar || retail ? (
                <>
                  <input type="hidden" name="unit" value={formState.unit} />
                  <p className="mb-1.5 text-[11px] font-medium text-slate-700">
                    Unité de stock
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unitOptions.map((unit) => {
                      const active = formState.unit === unit;
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() =>
                            onChange((current) => {
                              const suggestion = suggestedShopLot(unit);
                              if (shopLots && comesInLot && suggestion) {
                                return {
                                  ...current,
                                  unit,
                                  packagingUnit: suggestion.packagingUnit,
                                  unitsPerPack: suggestion.unitsPerPack,
                                };
                              }
                              return { ...current, unit };
                            })
                          }
                          className={`inline-flex min-h-11 items-center rounded-md border px-3 text-[12px] font-semibold transition sm:min-h-9 sm:px-2.5 sm:text-[11px] ${
                            active
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {PRODUCT_UNIT_LABELS[unit]}
                        </button>
                      );
                    })}
                  </div>
                  {(formState.unit === "KG" || formState.unit === "LITER") && retail ? (
                    <p className="mt-2 text-[11px] font-medium text-emerald-700">
                      Vente au {formState.unit === "KG" ? "poids" : "volume"} activée en caisse
                      (quantité décimale).
                    </p>
                  ) : null}
                </>
              ) : (
                <SelectField
                  id="unit"
                  name="unit"
                  label="Unité"
                  required
                  value={formState.unit}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      unit: event.target.value as ProductFormState["unit"],
                    }))
                  }
                >
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {PRODUCT_UNIT_LABELS[unit]}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>
          </div>
        </FormSection>

        {isBar && isCreate && (!retail || catalog.showPackaging) ? (
          <FormSection
            title={shopLots ? "Vient en lot ? (optionnel)" : "Conditionnement"}
            compact
          >
            {shopLots ? (
              <>
                <p className="text-[11px] leading-snug text-slate-500">
                  Sachets d’eau en pack, huile en carton de 5 bidons… Le stock se
                  compte à l’unité. En caisse : vente à l’unité ou en gros.
                </p>
                <ToggleField
                  id="comesInLot"
                  name="comesInLot"
                  label="Ce produit vient en lot"
                  checked={comesInLot}
                  onChange={(enabled) => {
                    setComesInLot(enabled);
                    onChange((current) => {
                      if (!enabled) {
                        return { ...current, unitsPerPack: 0, lotSellingPrice: 0 };
                      }
                      const suggestion = suggestedShopLot(current.unit);
                      return {
                        ...current,
                        packagingUnit: suggestion?.packagingUnit ?? "CARTON",
                        unitsPerPack:
                          suggestion?.unitsPerPack ??
                          SHOP_PACKAGING_DEFAULT_UNITS.CARTON,
                      };
                    });
                  }}
                />
              </>
            ) : null}

            {!shopLots || comesInLot ? (
              <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <SelectField
                id="packagingUnit"
                name="packagingUnit"
                label={shopLots ? "Type de lot" : "Format d’achat"}
                required={!retail}
                value={formState.packagingUnit}
                onChange={(event) => {
                  const packagingUnit = event.target.value as BarPackagingUnit;
                  const shopDefault =
                    shopLots &&
                    (SHOP_PACKAGING_UNITS as readonly string[]).includes(packagingUnit)
                      ? SHOP_PACKAGING_DEFAULT_UNITS[
                          packagingUnit as (typeof SHOP_PACKAGING_UNITS)[number]
                        ]
                      : undefined;
                  onChange((current) => ({
                    ...current,
                    packagingUnit,
                    unitsPerPack:
                      shopDefault ?? BAR_PACKAGING_DEFAULT_UNITS[packagingUnit],
                  }));
                }}
              >
                {packagingChoices.map((unit) => (
                  <option key={unit} value={unit}>
                    {BAR_PACKAGING_LABELS[unit]}
                  </option>
                ))}
              </SelectField>

              <NumberField
                id="unitsPerPack"
                name="unitsPerPack"
                label={`${baseUnitLabel}s / ${packagingLabel.toLowerCase()}`}
                required={!retail}
                min={0}
                step={1}
                placeholder={shopLots ? "5" : "12"}
                value={formState.unitsPerPack === 0 ? "" : formState.unitsPerPack}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    unitsPerPack:
                      event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
              />
            </div>

            {shopLots ? (
              <PriceField
                id="lotSellingPrice"
                name="lotSellingPrice"
                label={`Prix du ${packagingLabel.toLowerCase()}`}
                placeholder="Ex : 20000"
                required
                value={formState.lotSellingPrice === 0 ? "" : formState.lotSellingPrice}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    lotSellingPrice:
                      event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
              />
            ) : null}

            {formState.unitsPerPack > 1 ? (
              <p className="text-[11px] font-medium text-emerald-700">
                1 {packagingLabel.toLowerCase()} = {formState.unitsPerPack}{" "}
                {baseUnitLabel.toLowerCase()}
                {formState.unitsPerPack > 1 ? "s" : ""}
                {shopLots && formState.lotSellingPrice > 0
                  ? ` · vendu ${formState.lotSellingPrice} F`
                  : ""}
                {shopLots
                  ? " — à l’appro, 1 lot ajoute ce nombre en stock."
                  : ""}
              </p>
            ) : null}
              </>
            ) : null}
          </FormSection>
        ) : null}

        {mode === "edit" &&
        editingProduct &&
        formState.departmentCode === "BAR" &&
        (!retail || shopLots) &&
        onPackagingsChanged ? (
          <ProductPackagingsEditor
            productId={editingProduct.id}
            baseUnit={formState.unit}
            packagings={packagings}
            onChanged={onPackagingsChanged}
            shopLots={shopLots}
          />
        ) : null}

        <FormSection title="Photo" compact>
          <ProductImageField
            existingUrl={
              editingProduct?.imageUrl ??
              editingProduct?.imageOriginalUrl ??
              editingProduct?.imageOptimizedUrl
            }
            onAssetsChange={onImageAssetsChange}
            compact
          />
        </FormSection>

        <ToggleField
          id="active"
          name="active"
          label={catalog.activeLabel}
          checked={formState.active}
          onChange={(active) => onChange((current) => ({ ...current, active }))}
        />
          </>
        )}
      </div>
    </ModalShell>
  );
}
