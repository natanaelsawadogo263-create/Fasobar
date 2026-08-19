"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Fuel, Plus } from "lucide-react";

import {
  createFuelTypeAction,
  updateFuelTypeAction,
  toggleFuelTypeAction,
} from "@/app/(protected)/application/station/actions";
import { formatPriceXof } from "@/lib/products/constants";
import type { FuelTypeItem } from "@/lib/station/types";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";

type Props = {
  data: FuelTypeItem[];
};

export function FuelTypesWorkspace({ data }: Props) {
  const router = useRouter();
  const { success, error } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<FuelTypeItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function closeModal() {
    setEditing(null);
    setShowCreate(false);
    setFormError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFormError(null);

    startTransition(async () => {
      const action = editing ? updateFuelTypeAction : createFuelTypeAction;
      const result = await action({}, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      success(result.success ?? "Enregistré.");
      closeModal();
      router.refresh();
    });
  }

  function handleToggle(item: FuelTypeItem) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", item.id);
      formData.set("active", String(!item.active));
      const result = await toggleFuelTypeAction({}, formData);
      if (result.error) {
        error(result.error);
        return;
      }
      success(result.success ?? "Statut mis à jour.");
      router.refresh();
    });
  }

  const modalOpen = showCreate || !!editing;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 lg:py-4">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px]">
            Carburants
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px]">
            {data.length} type{data.length > 1 ? "s" : ""} de carburant
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={isPending}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white shadow-sm active:bg-emerald-500 disabled:opacity-60 sm:h-9 sm:hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sm:hidden">Ajouter</span>
          <span className="hidden sm:inline">Ajouter un carburant</span>
        </button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <Fuel className="h-10 w-10 text-slate-300" />
              <p className="text-[13px] text-slate-500">
                Aucun carburant configuré.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 p-2">
              {data.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <span
                          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.active ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatPriceXof(item.selling_price)} / litre
                        <span className="text-slate-300"> · </span>
                        Stock min. {item.minimum_stock} L
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-60"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(item)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-60"
                    >
                      {item.active ? "Désactiver" : "Activer"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {modalOpen ? (
        <ModalShell
          title={editing ? "Modifier le carburant" : "Nouveau carburant"}
          onClose={closeModal}
          formId="fuel-type-form"
          onSubmit={handleSubmit}
          compact
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="h-10 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700 active:bg-slate-50 sm:h-9"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="fuel-type-form"
                disabled={isPending}
                className="h-10 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm active:bg-emerald-500 disabled:opacity-60 sm:h-9 sm:hover:bg-emerald-500"
              >
                {isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {formError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                {formError}
              </p>
            ) : null}

            {editing ? (
              <input type="hidden" name="id" value={editing.id} />
            ) : null}

            <div>
              <label
                htmlFor="ft-name"
                className="mb-1 block text-[12px] font-medium text-slate-700"
              >
                Nom
              </label>
              <input
                id="ft-name"
                name="name"
                type="text"
                required
                defaultValue={editing?.name ?? ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-9"
                placeholder="Ex : Super Sans Plomb"
              />
            </div>

            <div>
              <label
                htmlFor="ft-price"
                className="mb-1 block text-[12px] font-medium text-slate-700"
              >
                Prix de vente (FCFA / litre)
              </label>
              <input
                id="ft-price"
                name="sellingPrice"
                type="number"
                required
                min={1}
                step={1}
                defaultValue={editing?.selling_price ?? ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-9"
                placeholder="Ex : 650"
              />
            </div>

            <div>
              <label
                htmlFor="ft-minstock"
                className="mb-1 block text-[12px] font-medium text-slate-700"
              >
                Stock minimum (litres)
              </label>
              <input
                id="ft-minstock"
                name="minimumStock"
                type="number"
                min={0}
                step="0.001"
                defaultValue={editing?.minimum_stock ?? 0}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-9"
                placeholder="Ex : 500"
              />
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
