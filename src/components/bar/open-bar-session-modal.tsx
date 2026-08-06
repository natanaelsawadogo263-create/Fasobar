"use client";

import { User } from "lucide-react";

import { AlertMessage } from "@/components/auth/alert-message";
import { TextField } from "@/components/ui/form-controls";
import { ModalShell } from "@/components/ui/modal-shell";

type OpenBarSessionModalProps = {
  formAction: (payload: FormData) => void;
  error?: string;
  isPending?: boolean;
  managerName?: string;
};

export function OpenBarSessionModal({
  formAction,
  error,
  isPending = false,
  managerName,
}: OpenBarSessionModalProps) {
  return (
    <ModalShell
      formId="open-bar-session-form"
      title="Ouvrir le service bar"
      subtitle="Démarrez votre session. Les opérations seront rattachées à votre bilan."
      onClose={() => undefined}
      dismissible={false}
      onSubmit={(event) => {
        event.preventDefault();
        formAction(new FormData(event.currentTarget));
      }}
      footer={
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Ouverture…" : "Ouvrir le service"}
          </button>
        </div>
      }
    >
      {managerName ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Responsable connecté</p>
            <p className="text-sm font-semibold text-slate-900">{managerName}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <AlertMessage message={error} />
        </div>
      ) : null}

      <TextField
        id="openingNote"
        name="openingNote"
        label="Note de prise de service (facultatif)"
        placeholder="Ex. relève du soir, stock à vérifier"
        disabled={isPending}
        autoFocus
      />
    </ModalShell>
  );
}
