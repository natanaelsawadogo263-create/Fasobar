"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Gauge, Plus } from "lucide-react";

import {
  createFuelPumpAction,
  updateFuelPumpAction,
} from "@/app/(protected)/application/station/actions";
import type {
  FuelPumpItem,
  FuelTankOption,
  FuelTypeOption,
} from "@/lib/station/types";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";

type Props = {
  data: FuelPumpItem[];
  fuelTypeOptions: FuelTypeOption[];
  fuelTankOptions: FuelTankOption[];
};

export function FuelPumpsWorkspace({
  data,
  fuelTypeOptions,
  fuelTankOptions,
}: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<FuelPumpItem | null>(null);
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
      const action = editing ? updateFuelPumpAction : createFuelPumpAction;
      const result = await action({}, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      show(result.success ?? "Enregistré.");
      closeModal();
      router.refresh();
    });
  }

  const modalOpen = showCreate || !!editing;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 lg:py-4">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px]">
            Pompes
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px]">
            {data.length} pompe{data.length > 1 ? "s" : ""}
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
          <span className="hidden sm:inline">Ajouter une pompe</span>
        </button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <Gauge className="h-10 w-10 text-slate-300" />
              <p className="text-[13px] text-slate-500">
                Aucune pompe configurée.
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
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {item.fuel_type_name}
                        <span className="text-slate-300"> · </span>
                        Cuve : {item.fuel_tank_name}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                        Index : {item.current_index.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
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
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {modalOpen ? (
        <ModalShell
          title={editing ? "Modifier la pompe" : "Nouvelle pompe"}
          onClose={closeModal}
          formId="fuel-pump-form"
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
                form="fuel-pump-form"
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
                htmlFor="pump-name"
                className="mb-1 block text-[12px] font-medium text-slate-700"
              >
                Nom
              </label>
              <input
                id="pump-name"
                name="name"
                type="text"
                required
                defaultValue={editing?.name ?? ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-9"
                placeholder="Ex : Pompe 1"
              />
            </div>

            <div>
              <label
                htmlFor="pump-fuel-type"
                className="mb-1 block text-[12px] font-medium text-slate-700"
              >
                Type de carburant
              </label>
              <select
                id="pump-fuel-type"
                name="fuelTypeId"
                required
                defaultValue={editing?.fuel_type_id ?? ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-9"
              >
                <option value="">Sélectionnez…</option>
                {fuelTypeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pump-tank"
                className="mb-1 block text-[12px] font-medium text-slate-700"
              >
                Cuve
              </label>
              <select
                id="pump-tank"
                name="fuelTankId"
                required
                defaultValue={editing?.fuel_tank_id ?? ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-9"
              >
                <option value="">Sélectionnez…</option>
                {fuelTankOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {!editing ? (
              <div>
                <label
                  htmlFor="pump-index"
                  className="mb-1 block text-[12px] font-medium text-slate-700"
                >
                  Index initial
                </label>
                <input
                  id="pump-index"
                  name="initialIndex"
                  type="number"
                  min={0}
                  step="0.001"
                  defaultValue={0}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-9"
                  placeholder="0"
                />
              </div>
            ) : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
