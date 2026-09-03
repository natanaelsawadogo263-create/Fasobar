"use client";

import { useMemo } from "react";

import { AlertMessage } from "@/components/auth/alert-message";
import {
  FormSection,
  NumberField,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/ui/form-controls";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  DEPARTMENT_LABELS,
  PRODUCT_UNIT_LABELS,
  PRODUCT_UNITS,
} from "@/lib/products/constants";
import type { DepartmentCode } from "@/lib/products/schemas";
import { KITCHEN_INGREDIENT_SUGGESTIONS } from "@/lib/stock/constants";
import type { StockProductOption } from "@/lib/stock/types";

const FORM_ID = "stock-item-form";

export type StockItemFormState = {
  name: string;
  departmentCode: DepartmentCode;
  productId: string;
  unit: (typeof PRODUCT_UNITS)[number];
  initialQuantity: number;
  minimumQuantity: number;
  active: boolean;
  confirmDuplicateProductLink: boolean;
};

type StockItemFormModalProps = {
  formState: StockItemFormState;
  products: StockProductOption[];
  formError: string | null;
  canManageBarStock: boolean;
  canManageKitchenStock: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  onChange: (updater: (current: StockItemFormState) => StockItemFormState) => void;
};

export function StockItemFormModal({
  formState,
  products,
  formError,
  canManageBarStock,
  canManageKitchenStock,
  onClose,
  onSubmit,
  onChange,
}: StockItemFormModalProps) {
  const isKitchen = formState.departmentCode === "KITCHEN";

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) => product.departmentCode === formState.departmentCode,
      ),
    [products, formState.departmentCode],
  );

  const selectedProduct = filteredProducts.find(
    (product) => product.id === formState.productId,
  );

  const duplicateLink =
    !isKitchen &&
    selectedProduct?.linkedStockItemId !== null &&
    selectedProduct?.linkedStockItemId !== undefined;

  const unitLabel =
    PRODUCT_UNIT_LABELS[formState.unit as keyof typeof PRODUCT_UNIT_LABELS] ??
    formState.unit;

  return (
    <ModalShell
      formId={FORM_ID}
      title="Nouvel article de stock"
      subtitle={
        isKitchen
          ? "Cuisine : matières premières (riz, huile, légumes…) — pas des plats vendus."
          : "Boissons : articles à suivre dans le stock bar."
      }
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
      footer={
        <ModalFooter onCancel={onClose} submitLabel="Enregistrer l'article" />
      }
    >
      {formError ? (
        <div className="mb-5">
          <AlertMessage message={formError} />
        </div>
      ) : null}

      <div className="space-y-8">
        <FormSection
          title="Informations principales"
          description={
            isKitchen
              ? "Nommez l'ingrédient ou la denrée stockée en cuisine."
              : "Identifiez l'article et son département."
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="name"
              name="name"
              label={isKitchen ? "Nom de l'ingrédient" : "Nom de l'article"}
              required
              placeholder={
                isKitchen
                  ? "Ex : Sac de riz, Huile, Oignons…"
                  : "Ex : Bière Brakina, Casier Flag…"
              }
              value={formState.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              className="md:col-span-2"
            />

            {isKitchen ? (
              <div className="md:col-span-2">
                <p className="mb-2 text-[11px] font-medium text-slate-500">
                  Suggestions matières premières
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {KITCHEN_INGREDIENT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.name}
                      type="button"
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          name: suggestion.name,
                          unit: suggestion.unit,
                          productId: "",
                        }))
                      }
                      className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-900 transition hover:bg-orange-100 active:bg-orange-200"
                    >
                      {suggestion.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

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
                  productId: "",
                  unit: departmentCode === "KITCHEN" ? "KG" : "BOTTLE",
                  name: "",
                }));
              }}
            >
              {canManageBarStock ? (
                <option value="BAR">{DEPARTMENT_LABELS.BAR}</option>
              ) : null}
              {canManageKitchenStock ? (
                <option value="KITCHEN">{DEPARTMENT_LABELS.KITCHEN}</option>
              ) : null}
            </SelectField>

            {isKitchen ? (
              <>
                <input type="hidden" name="productId" value="" />
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 px-3.5 py-3 text-[12px] text-orange-950 md:col-span-1">
                  <p className="font-semibold">Stock cuisine = denrées</p>
                  <p className="mt-1 leading-relaxed text-orange-900/80">
                    Les plats (poulet braisé, attiéké…) sont des produits de vente. Ici on
                    suit les matières premières : sacs, huile, viandes, légumes…
                  </p>
                </div>
              </>
            ) : (
              <SelectField
                id="productId"
                name="productId"
                label="Produit vendu associé"
                hint="Facultatif — liez une boisson du catalogue pour le suivi."
                value={formState.productId}
                onChange={(event) => {
                  const productId = event.target.value;
                  const product = filteredProducts.find((item) => item.id === productId);

                  onChange((current) => ({
                    ...current,
                    productId,
                    name: product && !current.name ? product.name : current.name,
                    unit: product
                      ? (product.unit as StockItemFormState["unit"])
                      : current.unit,
                    confirmDuplicateProductLink: false,
                  }));
                }}
              >
                <option value="">Aucun produit</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.linkedStockItemName
                      ? ` — déjà lié à « ${product.linkedStockItemName} »`
                      : ""}
                  </option>
                ))}
              </SelectField>
            )}
          </div>

          {duplicateLink && selectedProduct ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p>
                Ce produit est déjà suivi par l&apos;article «{" "}
                <span className="font-semibold">{selectedProduct.linkedStockItemName}</span>
                ».
              </p>
              <div className="mt-3">
                <ToggleField
                  id="confirmDuplicateProductLink"
                  name="confirmDuplicateProductLink"
                  label="Confirmer un second lien"
                  description="Autorise de lier ce produit à un nouvel article de stock."
                  checked={formState.confirmDuplicateProductLink}
                  onChange={(checked) =>
                    onChange((current) => ({
                      ...current,
                      confirmDuplicateProductLink: checked,
                    }))
                  }
                />
              </div>
            </div>
          ) : null}
        </FormSection>

        <FormSection
          title="Stock et unité"
          description={
            isKitchen
              ? "Ex. kilogrammes pour le riz, litres pour l'huile, pièces pour les bidons."
              : "Définissez l'unité de stockage et les seuils."
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="unit"
              name="unit"
              label="Unité de stockage"
              required
              value={formState.unit}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  unit: event.target.value as StockItemFormState["unit"],
                }))
              }
            >
              {PRODUCT_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {PRODUCT_UNIT_LABELS[unit]}
                </option>
              ))}
            </SelectField>

            <NumberField
              id="initialQuantity"
              name="initialQuantity"
              label={`Quantité initiale (${unitLabel.toLowerCase()})`}
              min={0}
              step="any"
              value={formState.initialQuantity}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  initialQuantity: Number(event.target.value),
                }))
              }
            />

            <NumberField
              id="minimumQuantity"
              name="minimumQuantity"
              label={`Stock minimum (${unitLabel.toLowerCase()})`}
              min={0}
              step="any"
              value={formState.minimumQuantity}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  minimumQuantity: Number(event.target.value),
                }))
              }
            />

            <div className="md:col-span-2">
              <ToggleField
                id="active"
                name="active"
                label="Article actif"
                description={
                  isKitchen
                    ? "Un article inactif n'apparaît plus dans les entrées cuisine."
                    : "Un article inactif n'apparaît plus dans les mouvements de stock."
                }
                checked={formState.active}
                onChange={(checked) =>
                  onChange((current) => ({ ...current, active: checked }))
                }
              />
            </div>
          </div>
        </FormSection>
      </div>
    </ModalShell>
  );
}
