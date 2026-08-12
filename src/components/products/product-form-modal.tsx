"use client";

import { useEffect, useMemo, useRef } from "react";

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
  BAR_BASE_UNITS,
  BAR_PACKAGING_DEFAULT_UNITS,
  BAR_PACKAGING_LABELS,
  BAR_PACKAGING_UNITS,
  DEPARTMENT_LABELS,
  PRODUCT_UNIT_LABELS,
  PRODUCT_UNITS,
} from "@/lib/products/constants";
import type { CategoryOption, ProductListItem, ProductPackaging } from "@/lib/products/types";
import type { BarPackagingUnit, DepartmentCode, ProductUnit } from "@/lib/products/schemas";

const FORM_ID = "product-form";

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
};

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
}: ProductFormModalProps) {
  const isCreate = mode === "create";
  const isBar = formState.departmentCode === "BAR";
  const departmentChoices = allowedDepartments?.length
    ? Object.entries(DEPARTMENT_LABELS).filter(([code]) =>
        allowedDepartments.includes(code as DepartmentCode),
      )
    : Object.entries(DEPARTMENT_LABELS);
  const lockDepartment = departmentChoices.length === 1;
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [formError]);

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.departmentCode === formState.departmentCode),
    [categories, formState.departmentCode],
  );

  const unitOptions = useMemo(() => {
    if (!isBar) {
      return PRODUCT_UNITS;
    }
    if ((BAR_BASE_UNITS as readonly ProductUnit[]).includes(formState.unit)) {
      return [...BAR_BASE_UNITS];
    }
    return [formState.unit, ...BAR_BASE_UNITS];
  }, [formState.unit, isBar]);
  const baseUnitLabel =
    PRODUCT_UNIT_LABELS[formState.unit] ?? formState.unit;
  const packagingLabel = BAR_PACKAGING_LABELS[formState.packagingUnit];

  return (
    <ModalShell
      formId={FORM_ID}
      compact
      title={isCreate ? "Ajouter un produit" : "Modifier le produit"}
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
          onClientValidationError?.("Indiquez le nom du produit (au moins 2 caractères).");
          return;
        }
        if (!formState.categoryId) {
          onClientValidationError?.(
            "Sélectionnez une catégorie (ex. Bières, Sodas…).",
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
        if (isBar && isCreate) {
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

        const formData = new FormData();
        formData.set("name", name);
        formData.set("departmentCode", formState.departmentCode);
        formData.set("categoryId", formState.categoryId);
        formData.set("sellingPrice", String(formState.sellingPrice));
        formData.set("unit", formState.unit);
        formData.set("minimumStock", String(formState.minimumStock));
        formData.set("description", formState.description.trim());
        formData.set("active", formState.active ? "on" : "off");
        if (isBar && isCreate) {
          formData.set("packagingUnit", formState.packagingUnit);
          formData.set("unitsPerPack", String(formState.unitsPerPack));
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

        <FormSection title="Produit" compact>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextField
              id="name"
              name="name"
              label="Nom"
              required
              placeholder="Ex : Flag 65cl"
              value={formState.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              className="sm:col-span-2"
            />

            {lockDepartment ? (
              <>
                <input type="hidden" name="departmentCode" value={formState.departmentCode} />
                <div>
                  <p className="mb-1 text-[11px] font-medium text-slate-700">Département</p>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-800">
                    {DEPARTMENT_LABELS[formState.departmentCode]}
                  </p>
                </div>
              </>
            ) : (
              <SelectField
                id="departmentCode"
                name="departmentCode"
                label="Département"
                required
                value={formState.departmentCode}
                onChange={(event) => {
                  const departmentCode = event.target.value as DepartmentCode;
                  onChange((current) => ({
                    ...current,
                    departmentCode,
                    categoryId: "",
                    unit: departmentCode === "BAR" ? "BOTTLE" : "PORTION",
                    packagingUnit: "CASE",
                    unitsPerPack: BAR_PACKAGING_DEFAULT_UNITS.CASE,
                  }));
                }}
              >
                {departmentChoices.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </SelectField>
            )}

            <SelectField
              id="categoryId"
              name="categoryId"
              label="Catégorie"
              required
              value={formState.categoryId}
              onChange={(event) =>
                onChange((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              <option value="">Choisir…</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            {filteredCategories.length === 0 ? (
              <p className="sm:col-span-2 text-[11px] text-amber-700">
                Aucune catégorie pour ce département.
              </p>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Prix & stock" compact>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <PriceField
              id="sellingPrice"
              name="sellingPrice"
              label="Prix de vente"
              placeholder="Ex : 1000"
              value={formState.sellingPrice === 0 ? "" : formState.sellingPrice}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  sellingPrice: event.target.value === "" ? 0 : Number(event.target.value),
                }))
              }
            />

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
              {isBar ? (
                <>
                  <input type="hidden" name="unit" value={formState.unit} />
                  <p className="mb-1.5 text-[11px] font-medium text-slate-700">
                    Unité de stock
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {BAR_BASE_UNITS.map((unit) => {
                      const active = formState.unit === unit;
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() =>
                            onChange((current) => ({ ...current, unit }))
                          }
                          className={`min-h-9 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition ${
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

        {isBar && isCreate ? (
          <FormSection title="Conditionnement" compact>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <SelectField
                id="packagingUnit"
                name="packagingUnit"
                label="Format d’achat"
                required
                value={formState.packagingUnit}
                onChange={(event) => {
                  const packagingUnit = event.target.value as BarPackagingUnit;
                  onChange((current) => ({
                    ...current,
                    packagingUnit,
                    unitsPerPack: BAR_PACKAGING_DEFAULT_UNITS[packagingUnit],
                  }));
                }}
              >
                {BAR_PACKAGING_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {BAR_PACKAGING_LABELS[unit]}
                  </option>
                ))}
              </SelectField>

              <NumberField
                id="unitsPerPack"
                name="unitsPerPack"
                label={`${baseUnitLabel}s / ${packagingLabel.toLowerCase()}`}
                required
                min={1}
                step={1}
                placeholder="12"
                value={formState.unitsPerPack || ""}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    unitsPerPack:
                      event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
              />
            </div>

            {formState.unitsPerPack > 0 ? (
              <p className="text-[11px] font-medium text-emerald-700">
                1 {packagingLabel.toLowerCase()} = {formState.unitsPerPack}{" "}
                {baseUnitLabel.toLowerCase()}
                {formState.unitsPerPack > 1 ? "s" : ""}
              </p>
            ) : null}
          </FormSection>
        ) : null}

        {mode === "edit" &&
        editingProduct &&
        formState.departmentCode === "BAR" &&
        onPackagingsChanged ? (
          <ProductPackagingsEditor
            productId={editingProduct.id}
            baseUnit={formState.unit}
            packagings={packagings}
            onChanged={onPackagingsChanged}
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
          label="Produit actif"
          checked={formState.active}
          onChange={(active) => onChange((current) => ({ ...current, active }))}
        />
      </div>
    </ModalShell>
  );
}
