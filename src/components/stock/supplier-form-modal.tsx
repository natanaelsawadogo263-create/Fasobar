"use client";

import { AlertMessage } from "@/components/auth/alert-message";
import {
  FormSection,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/ui/form-controls";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import type { SupplierOption } from "@/lib/stock/types";

const FORM_ID = "supplier-form";

const SPACE_LABELS = {
  BAR: "Bar",
  KITCHEN: "Cuisine",
} as const;

export type SupplierFormState = {
  name: string;
  phone: string;
  address: string;
  departmentCode: "BAR" | "KITCHEN";
  active: boolean;
};

type SupplierFormModalProps = {
  mode: "create" | "edit";
  formState: SupplierFormState;
  editingSupplier: SupplierOption | null;
  formError: string | null;
  /** Si défini, le département est figé (ex. espace Bar). */
  lockedDepartment?: "BAR" | "KITCHEN" | null;
  /** Commerce (quincaillerie, boutique…) : pas de Bar / Cuisine. */
  hideDepartment?: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  onChange: (updater: (current: SupplierFormState) => SupplierFormState) => void;
};

export function SupplierFormModal({
  mode,
  formState,
  editingSupplier,
  formError,
  lockedDepartment = null,
  hideDepartment = false,
  onClose,
  onSubmit,
  onChange,
}: SupplierFormModalProps) {
  const isCreate = mode === "create";
  const departmentValue = lockedDepartment ?? formState.departmentCode;

  return (
    <ModalShell
      formId={FORM_ID}
      title={isCreate ? "Ajouter un fournisseur" : "Modifier le fournisseur"}
      subtitle={
        isCreate
          ? hideDepartment
            ? "Nom, téléphone et adresse du fournisseur."
            : "Indiquez s'il livre le Bar ou la Cuisine."
          : "Mettez à jour les informations du fournisseur."
      }
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel={isCreate ? "Enregistrer le fournisseur" : "Mettre à jour"}
        />
      }
    >
      {formError ? (
        <div className="mb-5">
          <AlertMessage message={formError} />
        </div>
      ) : null}

      <div className="space-y-6">
        {mode === "edit" && editingSupplier ? (
          <input type="hidden" name="supplierId" value={editingSupplier.id} />
        ) : null}

        <FormSection title="Informations">
          <div className="grid gap-4 md:grid-cols-2">
            {hideDepartment ? (
              <input type="hidden" name="departmentCode" value={departmentValue} />
            ) : lockedDepartment ? (
              <>
                <input type="hidden" name="departmentCode" value={lockedDepartment} />
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 md:col-span-2">
                  Espace :{" "}
                  <span className="font-semibold text-slate-900">
                    {SPACE_LABELS[lockedDepartment]}
                  </span>
                </p>
              </>
            ) : (
              <SelectField
                id="departmentCode"
                name="departmentCode"
                label="Espace"
                required
                value={departmentValue}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    departmentCode: event.target.value as "BAR" | "KITCHEN",
                  }))
                }
                className="md:col-span-2"
              >
                <option value="BAR">{SPACE_LABELS.BAR}</option>
                <option value="KITCHEN">{SPACE_LABELS.KITCHEN}</option>
              </SelectField>
            )}
            <TextField
              id="name"
              name="name"
              label="Nom"
              required
              placeholder="Ex : Société ABC Distribution"
              value={formState.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              className="md:col-span-2"
            />
            <TextField
              id="phone"
              name="phone"
              label="Téléphone"
              placeholder="+226 70 00 00 00"
              value={formState.phone}
              onChange={(event) =>
                onChange((current) => ({ ...current, phone: event.target.value }))
              }
            />
            <TextField
              id="address"
              name="address"
              label="Adresse"
              placeholder="Ouagadougou, Burkina Faso"
              value={formState.address}
              onChange={(event) =>
                onChange((current) => ({ ...current, address: event.target.value }))
              }
            />
            <div className="md:col-span-2">
              <ToggleField
                id="active"
                name="active"
                label="Fournisseur actif"
                description="Seuls les fournisseurs actifs apparaissent lors des entrées."
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
