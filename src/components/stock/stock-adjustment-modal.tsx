"use client";

import { useState } from "react";

import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { FormSection, NumberField, TextField, ToggleField } from "@/components/ui/form-controls";
import { PRODUCT_UNIT_LABELS } from "@/lib/stock/constants";
import type { StockListItem } from "@/lib/stock/types";

type StockAdjustmentModalProps = {
  stockItem: StockListItem;
  formError: string | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
};

export function StockAdjustmentModal({
  stockItem,
  formError,
  onClose,
  onSubmit,
}: StockAdjustmentModalProps) {
  const [newQuantity, setNewQuantity] = useState(String(stockItem.currentQuantity));
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const unitLabel =
    PRODUCT_UNIT_LABELS[stockItem.unit as keyof typeof PRODUCT_UNIT_LABELS] ??
    stockItem.unit;

  const delta =
    Math.round((Number(newQuantity) - stockItem.currentQuantity) * 1000) / 1000;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <ModalShell
      formId="stock-adjustment-form"
      title="Corriger le stock"
      subtitle={`Ajustement pour ${stockItem.name}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={<ModalFooter onCancel={onClose} submitLabel="Appliquer la correction" />}
    >
      <div className="space-y-6">
        {formError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <input type="hidden" name="stockItemId" value={stockItem.id} />

        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            Stock actuel :{" "}
            <span className="font-semibold">
              {stockItem.currentQuantity} {unitLabel.toLowerCase()}
              {stockItem.currentQuantity > 1 ? "s" : ""}
            </span>
          </p>
          {delta !== 0 ? (
            <p className="mt-1">
              Écart après correction :{" "}
              <span className="font-semibold">
                {delta > 0 ? "+" : ""}
                {delta} {unitLabel.toLowerCase()}
                {Math.abs(delta) > 1 ? "s" : ""}
              </span>
            </p>
          ) : null}
        </div>

        <FormSection title="Nouvelle quantité">
          <NumberField
            id="newQuantity"
            name="newQuantity"
            label={`Quantité corrigée (${unitLabel.toLowerCase()})`}
            value={newQuantity}
            onChange={(event) => setNewQuantity(event.target.value)}
            min={0}
            step="any"
            required
          />
          <TextField
            id="reason"
            name="reason"
            label="Motif de correction"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex. Écart constaté lors du contrôle"
            required
          />
          <ToggleField
            id="confirmed"
            name="confirmed"
            label="Je confirme cette correction"
            description="Cette action créera un mouvement d'inventaire immuable."
            checked={confirmed}
            onChange={setConfirmed}
          />
        </FormSection>
      </div>
    </ModalShell>
  );
}
