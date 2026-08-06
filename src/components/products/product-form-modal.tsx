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
  BAR_BASE_UNIT_HINTS,
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
  onClientValidationError,
}: ProductFormModalProps) {
  const isCreate = mode === "create";
  const isBar = formState.departmentCode === "BAR";
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
      title={isCreate ? "Ajouter un produit" : "Modifier le produit"}
      subtitle={
        isCreate
          ? "Créez un produit pour cet établissement."
          : "Mettez à jour les informations de ce produit."
      }
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
        formData.set("imageSelection", imageAssets.selection);
        if (imageAssets.originalFile) {
          formData.set("imageOriginal", imageAssets.originalFile);
        }
        if (imageAssets.optimizedFile) {
          formData.set("imageOptimized", imageAssets.optimizedFile);
        }
        // Compat affichage / upload legacy
        const primary =
          imageAssets.selection === "optimized"
            ? imageAssets.optimizedFile ?? imageAssets.originalFile
            : imageAssets.originalFile ?? imageAssets.optimizedFile;
        if (primary) {
          formData.set("image", primary);
        }
        onSubmit(formData);
      }}
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel={isCreate ? "Enregistrer le produit" : "Mettre à jour le produit"}
          isPending={isPending}
        />
      }
    >
      {formError ? (
        <div className="mb-5" id="product-form-error" ref={errorRef}>
          <AlertMessage message={formError} />
        </div>
      ) : null}

      <div className="space-y-8">
        {mode === "edit" && editingProduct ? (
          <input type="hidden" name="productId" value={editingProduct.id} />
        ) : null}

        <FormSection
          title="Images catalogue"
          description="Conservez l'originale et générez une version optimisée prête pour les cartes produit."
        >
          <ProductImageField
            existingOriginalUrl={
              editingProduct?.imageOriginalUrl ?? editingProduct?.imageUrl
            }
            existingOptimizedUrl={editingProduct?.imageOptimizedUrl}
            productName={formState.name}
            categoryName={
              filteredCategories.find((category) => category.id === formState.categoryId)
                ?.name ?? ""
            }
            departmentCode={formState.departmentCode}
            onAssetsChange={onImageAssetsChange}
          />
        </FormSection>

        <FormSection
          title="Informations principales"
          description="Identifiez le produit dans votre catalogue."
        >
          <div className="grid gap-4 md:grid-cols-2">
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
              className="md:col-span-2"
            />

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
              {Object.entries(DEPARTMENT_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </SelectField>

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
              <option value="">Sélectionner une catégorie</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            {filteredCategories.length === 0 ? (
              <p className="md:col-span-2 text-[12px] text-amber-700">
                Aucune catégorie pour ce département. Impossible d&apos;enregistrer le
                produit tant qu&apos;une catégorie n&apos;est pas disponible.
              </p>
            ) : null}
          </div>
        </FormSection>

        <FormSection
          title="Vente"
          description={
            isBar
              ? "Prix de vente unitaire et unité de stock (bouteille, canette, bidon ou sachet)."
              : "Définissez le prix et les conditions de vente."
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
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

            <SelectField
              id="unit"
              name="unit"
              label={isBar ? "Unité de stock" : "Unité"}
              hint={
                isBar
                  ? BAR_BASE_UNIT_HINTS[
                      formState.unit as (typeof BAR_BASE_UNITS)[number]
                    ] ??
                    "Choisissez comment le produit est compté en stock et vendu à l'unité."
                  : undefined
              }
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

            {isBar ? (
              <div className="md:col-span-2 flex flex-wrap gap-2">
                {BAR_BASE_UNITS.map((unit) => {
                  const active = formState.unit === unit;
                  return (
                    <button
                      key={unit}
                      type="button"
                      onClick={() =>
                        onChange((current) => ({ ...current, unit }))
                      }
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
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
            ) : null}

            <NumberField
              id="minimumStock"
              name="minimumStock"
              label="Stock minimum"
              required
              placeholder="0"
              value={formState.minimumStock}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  minimumStock: Number(event.target.value),
                }))
              }
              className="md:col-span-2 md:max-w-xs"
              hint={
                isBar
                  ? `Seuil d'alerte en ${baseUnitLabel.toLowerCase()}s`
                  : undefined
              }
            />
          </div>
        </FormSection>

        {isBar && isCreate ? (
          <FormSection
            title="Conditionnement d'achat"
            description={`Les boissons s'achètent par casier, carton ou sachet. Indiquez combien de ${baseUnitLabel.toLowerCase()}s contient chaque conditionnement.`}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                id="packagingUnit"
                name="packagingUnit"
                label="Format d'achat"
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
                label={`Nombre de ${baseUnitLabel.toLowerCase()}s à l'intérieur`}
                required
                min={1}
                step={1}
                placeholder="Ex : 12"
                value={formState.unitsPerPack || ""}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    unitsPerPack:
                      event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
                hint={`Combien de ${baseUnitLabel.toLowerCase()}s dans un ${packagingLabel.toLowerCase()} ?`}
              />
            </div>

            {formState.unitsPerPack > 0 ? (
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
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

        <FormSection title="Détails" description="Informations complémentaires.">
          <div className="space-y-4">
            <TextField
              id="description"
              name="description"
              label="Description"
              placeholder="Optionnel — notes internes ou détails de présentation"
              value={formState.description}
              onChange={(event) =>
                onChange((current) => ({ ...current, description: event.target.value }))
              }
            />

            <ToggleField
              id="active"
              name="active"
              label="Produit actif"
              description="Un produit inactif n'apparaît pas à la vente."
              checked={formState.active}
              onChange={(active) => onChange((current) => ({ ...current, active }))}
            />
          </div>
        </FormSection>
      </div>
    </ModalShell>
  );
}
