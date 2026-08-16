"use client";

import { useState } from "react";

import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { FormSection, NumberField, SelectField, TextField } from "@/components/ui/form-controls";
import { LOSS_TYPE_LABELS, formatProductUnitDisplay } from "@/lib/stock/constants";
import type { LossMovementType } from "@/lib/stock/schemas";
import type { StockListItem } from "@/lib/stock/types";

type StockLossModalProps = {
  stockItems: StockListItem[];
  preselectedItemId?: string | null;
  formError: string | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
};

export function StockLossModal({
  stockItems,
  preselectedItemId,
  formError,
  onClose,
  onSubmit,
}: StockLossModalProps) {
  const [stockItemId, setStockItemId] = useState(
    preselectedItemId ?? stockItems[0]?.id ?? "",
  );
  const [movementType, setMovementType] = useState<LossMovementType>("LOSS");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const selectedItem = stockItems.find((item) => item.id === stockItemId);
  const unitLabel = selectedItem
    ? formatProductUnitDisplay(selectedItem.unit, selectedItem.stockUnitLabel)
    : "unité";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <ModalShell
      formId="stock-loss-form"
      title="Déclarer une perte"
      subtitle="Enregistrez une perte, casse ou consommation interne."
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={<ModalFooter onCancel={onClose} submitLabel="Enregistrer la perte" />}
    >
      <div className="space-y-6">
        {formError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <FormSection title="Article concerné">
          <SelectField
            id="stockItemId"
            name="stockItemId"
            label="Article de stock"
            value={stockItemId}
            onChange={(event) => setStockItemId(event.target.value)}
            required
          >
            <option value="">Choisir un article</option>
            {stockItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — Stock actuel : {item.currentQuantity}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="movementType"
            name="movementType"
            label="Type de perte"
            value={movementType}
            onChange={(event) =>
              setMovementType(event.target.value as LossMovementType)
            }
          >
            {Object.entries(LOSS_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </FormSection>

        <FormSection title="Quantité">
          <NumberField
            id="quantity"
            name="quantity"
            label={`Quantité (${unitLabel.toLowerCase()})`}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            min={0.001}
            step="any"
            required
          />
          <TextField
            id="reason"
            name="reason"
            label="Motif"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex. Bouteille cassée lors du service"
            required
          />
        </FormSection>
      </div>
    </ModalShell>
  );
}
