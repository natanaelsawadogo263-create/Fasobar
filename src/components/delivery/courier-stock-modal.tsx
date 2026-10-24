"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import {
  allocateCourierStockAction,
  returnCourierStockAction,
} from "@/app/(protected)/application/livreurs/actions";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import { formatDeliveryQuantity } from "@/lib/delivery/constants";

export type CourierStockOption = {
  productId: string;
  name: string;
  /** Stock principal (remise) ou libre chez le livreur (retour). */
  available: number;
};

type CourierStockModalProps = {
  mode: "allocate" | "return";
  courierId: string;
  courierName: string;
  options: CourierStockOption[];
  onClose: () => void;
};

export function CourierStockModal({
  mode,
  courierId,
  courierName,
  options,
  onClose,
}: CourierStockModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? options.filter((option) => option.name.toLowerCase().includes(term)) : options;
  }, [options, search]);

  const items = Object.entries(quantities)
    .map(([productId, raw]) => ({ productId, quantity: Number(raw.replace(",", ".")) }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

  const isAllocate = mode === "allocate";
  const formId = `courier-stock-${mode}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) {
      setError("Indiquez au moins une quantité.");
      return;
    }
    const over = items.find((item) => {
      const option = options.find((candidate) => candidate.productId === item.productId);
      return option ? item.quantity > option.available : false;
    });
    if (over) {
      const option = options.find((candidate) => candidate.productId === over.productId);
      setError(
        `Quantité trop élevée pour « ${option?.name ?? "article"} » : ${formatDeliveryQuantity(
          option?.available ?? 0,
        )} disponible(s).`,
      );
      return;
    }
    setError(null);

    startTransition(async () => {
      const action = isAllocate ? allocateCourierStockAction : returnCourierStockAction;
      const result = await action({ courierId, items, note });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(result.success ?? "Enregistré.");
      onClose();
    });
  }

  return (
    <ModalShell
      formId={formId}
      title={isAllocate ? `Remettre du stock à ${courierName}` : `Retour de stock de ${courierName}`}
      subtitle={
        isAllocate
          ? "Les quantités sortent du stock principal et passent chez le livreur."
          : "Les quantités reviennent du livreur vers le stock principal."
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      compact
      footer={
        <ModalFooter
          onCancel={onClose}
          isPending={isPending}
          submitLabel={isAllocate ? "Remettre" : "Enregistrer le retour"}
          submitDisabled={items.length === 0}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un article…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>

        {options.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[13px] text-slate-500">
            {isAllocate
              ? "Aucun article en stock à remettre."
              : "Ce livreur n’a aucun article libre à rendre."}
          </p>
        ) : (
          <ul className="max-h-[45dvh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
            {filtered.map((option) => (
              <li key={option.productId} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{option.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {isAllocate ? "En stock" : "Libre chez le livreur"} :{" "}
                    {formatDeliveryQuantity(option.available)}
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  value={quantities[option.productId] ?? ""}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [option.productId]: event.target.value,
                    }))
                  }
                  className="input-no-spinner h-9 w-20 rounded-lg border border-slate-200 bg-white text-center text-sm outline-none focus:border-emerald-500"
                />
              </li>
            ))}
          </ul>
        )}

        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optionnel)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
