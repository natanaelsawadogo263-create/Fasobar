"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { AlertMessage } from "@/components/auth/alert-message";
import { StockArticleSearch } from "@/components/stock/stock-article-search";
import {
  NumberField,
  PriceField,
  SelectField,
  TextField,
} from "@/components/ui/form-controls";
import {
  buildStockBarcodeIndex,
  looksLikeBarcode,
  resolveStockBarcode,
} from "@/lib/catalog/barcode";
import { formatPriceXof, formatQuantity } from "@/lib/stock/constants";
import { formatProductUnitDisplay } from "@/lib/products/constants";
import type { ProductPackaging } from "@/lib/products/types";
import {
  buildSupplyLine,
  buildSupplyPurchaseModes,
  computeSupplyLineAmounts,
  supplyReceiptTotal,
  type SupplyLineDraft,
} from "@/lib/stock/supply-lines";
import type { StockListItem, SupplierOption, SupplyReceiptDetail } from "@/lib/stock/types";

type SupplyReceiptModalProps = {
  stockItems: StockListItem[];
  suppliers: SupplierOption[];
  packagingsByProduct: Record<string, ProductPackaging[]>;
  initialDraft?: SupplyReceiptDetail | null;
  formError: string | null;
  isPending?: boolean;
  onClose: () => void;
  onSave: (payload: {
    receiptId?: string;
    supplierId: string;
    receivedOn: string;
    notes?: string;
    validate: boolean;
    lines: Array<{
      stockItemId: string;
      productId: string | null;
      unitLevelId: string | null;
      unitName: string;
      purchasedQuantity: number;
      conversionFactor: number;
      stockQuantity: number;
      purchasePrice: number;
      lineTotal: number;
    }>;
  }) => void;
};

export function SupplyReceiptModal({
  stockItems,
  suppliers,
  packagingsByProduct,
  initialDraft = null,
  formError,
  isPending,
  onClose,
  onSave,
}: SupplyReceiptModalProps) {
  const [supplierId, setSupplierId] = useState(
    initialDraft?.supplierId ?? suppliers[0]?.id ?? "",
  );
  const [receivedOn, setReceivedOn] = useState(
    initialDraft?.receivedOn ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initialDraft?.notes ?? "");
  const [lines, setLines] = useState<SupplyLineDraft[]>(() =>
    (initialDraft?.lines ?? []).map((line) => ({
      clientId: crypto.randomUUID(),
      stockItemId: line.stockItemId,
      productId: line.productId,
      productName: line.productName,
      stockUnit: line.stockUnit,
      unitId: line.unitLevelId ?? "",
      unitName: line.unitName,
      factor: line.conversionFactor,
      quantity: line.purchasedQuantity,
      purchasePrice: line.purchasePrice,
      stockQuantity: line.stockQuantity,
      lineTotal: line.lineTotal,
    })),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [stockItemId, setStockItemId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  const barcodeIndex = useMemo(
    () => buildStockBarcodeIndex(stockItems, packagingsByProduct),
    [stockItems, packagingsByProduct],
  );

  function handleArticleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const raw = event.currentTarget.value.trim();
    if (!raw) return;
    const match = resolveStockBarcode(barcodeIndex, raw);
    if (!match) {
      if (looksLikeBarcode(raw)) {
        event.preventDefault();
        setUnknownCode(raw);
      }
      return;
    }
    event.preventDefault();
    setUnknownCode(null);
    setStockItemId(match.stockItem.id);
    setUnitId(match.unit?.id ?? "");
    event.currentTarget.blur();
  }

  const selectedItem = stockItems.find((item) => item.id === stockItemId) ?? null;
  const stockUnit = selectedItem
    ? formatProductUnitDisplay(selectedItem.unit, selectedItem.stockUnitLabel)
    : "unité";
  const modes = buildSupplyPurchaseModes(
    stockUnit,
    selectedItem?.productId ? packagingsByProduct[selectedItem.productId] : [],
  );
  const activeMode = modes.find((mode) => mode.id === unitId) ?? modes[0];
  const qtyNumber = Number(quantity) || 0;
  const priceNumber = Number(price) || 0;
  const preview = activeMode
    ? computeSupplyLineAmounts({
        quantity: qtyNumber,
        factor: activeMode.factor,
        purchasePrice: priceNumber,
      })
    : { stockQuantity: 0, lineTotal: 0 };

  const total = supplyReceiptTotal(lines);

  function addLine() {
    setLocalError(null);
    if (!selectedItem || !activeMode) {
      setLocalError("Choisissez un produit.");
      return;
    }
    if (!(qtyNumber > 0) || !(priceNumber >= 0) || price.trim() === "") {
      setLocalError("Indiquez la quantité et le prix d’achat.");
      return;
    }
    if (!(preview.stockQuantity > 0)) {
      setLocalError("La quantité stock calculée est invalide.");
      return;
    }
    const nextLine = buildSupplyLine({
      clientId: editingClientId ?? undefined,
      stockItemId: selectedItem.id,
      productId: selectedItem.productId,
      productName: selectedItem.name,
      stockUnit,
      mode: activeMode,
      quantity: qtyNumber,
      purchasePrice: Math.round(priceNumber),
    });
    setLines((current) =>
      editingClientId
        ? current.map((item) => (item.clientId === editingClientId ? nextLine : item))
        : [...current, nextLine],
    );
    setEditingClientId(null);
    setQuantity("1");
    setPrice("");
  }

  function submit(validate: boolean) {
    setLocalError(null);
    if (!supplierId) {
      setLocalError("Choisissez le fournisseur.");
      return;
    }
    if (lines.length === 0) {
      setLocalError("Ajoutez au moins un produit.");
      return;
    }
    onSave({
      receiptId: initialDraft?.id,
      supplierId,
      receivedOn,
      notes: notes.trim() || undefined,
      validate,
      lines: lines.map((line) => ({
        stockItemId: line.stockItemId,
        productId: line.productId,
        unitLevelId: line.unitId || null,
        unitName: line.unitName,
        purchasedQuantity: line.quantity,
        conversionFactor: line.factor,
        stockQuantity: line.stockQuantity,
        purchasePrice: line.purchasePrice,
        lineTotal: line.lineTotal,
      })),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        className="flex max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold text-slate-900">
              {initialDraft ? "Modifier l’approvisionnement" : "Nouvel approvisionnement"}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Plusieurs produits, une seule validation. Le stock change seulement à la validation.
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {formError || localError ? <AlertMessage message={formError ?? localError ?? ""} /> : null}

          <SelectField
            id="supply-supplier"
            name="supplierId"
            label="Fournisseur"
            required
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">Choisir…</option>
            {initialDraft && !suppliers.some((supplier) => supplier.id === initialDraft.supplierId) ? (
              <option value={initialDraft.supplierId}>{initialDraft.supplierName}</option>
            ) : null}
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </SelectField>
          <TextField
            id="supply-date"
            name="receivedOn"
            label="Date"
            type="date"
            value={receivedOn}
            onChange={(event) => setReceivedOn(event.target.value)}
          />
          <TextField
            id="supply-notes"
            name="notes"
            label="Notes (facultatif)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <section className="space-y-2 rounded-2xl border border-slate-200 p-3">
            <h3 className="text-[14px] font-semibold text-slate-900">Ajouter un produit</h3>
            <p className="text-[11px] text-slate-500">
              Scannez un code-barres (douchette USB) ou tapez le nom du produit.
            </p>
            <StockArticleSearch
              items={stockItems}
              value={stockItemId}
              onChange={(id) => {
                setStockItemId(id);
                setUnitId("");
                setUnknownCode(null);
              }}
              onKeyDown={handleArticleSearchKeyDown}
              label="Produit"
            />
            {unknownCode ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <span className="min-w-0">
                  <strong className="font-semibold">Code inconnu</strong> :{" "}
                  <span className="font-mono">{unknownCode}</span> — aucun produit associé.
                </span>
                <button
                  type="button"
                  onClick={() => setUnknownCode(null)}
                  aria-label="Fermer"
                  className="shrink-0 rounded-lg p-1 text-amber-700 hover:bg-amber-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {selectedItem ? (
              <>
                <SelectField
                  id="supply-unit"
                  name="unitId"
                  label="Unité d’achat"
                  value={activeMode?.id ?? ""}
                  onChange={(event) => setUnitId(event.target.value)}
                >
                  {modes.map((mode) => (
                    <option key={mode.id || mode.name} value={mode.id}>
                      {mode.kind === "pack" ? "Gros" : "Unité"} · {mode.name}
                    </option>
                  ))}
                </SelectField>
                {activeMode?.hint ? (
                  <p className="text-[12px] text-slate-500">{activeMode.hint}</p>
                ) : null}
                <NumberField
                  id="supply-qty"
                  name="quantity"
                  label="Quantité"
                  min={0.001}
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <PriceField
                  id="supply-price"
                  name="price"
                  label={`Prix d’achat / ${activeMode?.name ?? "unité"}`}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
                {preview.stockQuantity > 0 ? (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
                    {formatQuantity(preview.stockQuantity)} {stockUnit} seront ajoutées au stock.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  {editingClientId ? "Mettre à jour la ligne" : "Ajouter à la liste"}
                </button>
              </>
            ) : null}
          </section>

          <section className="space-y-2">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Liste ({lines.length})
            </h3>
            {lines.length === 0 ? (
              <p className="text-[13px] text-slate-500">Aucun produit pour l’instant.</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((line) => (
                  <li
                    key={line.clientId}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-slate-900">
                          {line.productName}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-600">
                          {line.quantity} {line.unitName} → +{formatQuantity(line.stockQuantity)}{" "}
                          {line.stockUnit}
                        </p>
                        <p className="text-[12px] font-medium text-slate-800">
                          {formatPriceXof(line.lineTotal)}
                        </p>
                      </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClientId(line.clientId);
                          setStockItemId(line.stockItemId);
                          setUnitId(line.unitId);
                          setQuantity(String(line.quantity));
                          setPrice(String(line.purchasePrice));
                        }}
                        className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-[12px] font-medium text-slate-600"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) => current.filter((item) => item.clientId !== line.clientId))
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500"
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-right text-[16px] font-bold tabular-nums text-slate-900">
              Total {formatPriceXof(total)}
            </p>
          </section>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row">
          <button
            type="button"
            disabled={isPending}
            onClick={() => submit(false)}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700 disabled:opacity-60"
          >
            Enregistrer brouillon
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => submit(true)}
            className="inline-flex h-12 flex-[1.3] items-center justify-center rounded-xl bg-emerald-600 text-[14px] font-semibold text-white disabled:opacity-60"
          >
            {isPending ? "Enregistrement…" : "Valider l’approvisionnement"}
          </button>
        </footer>
      </div>
    </div>
  );
}
