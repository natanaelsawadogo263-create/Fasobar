"use client";

import { User } from "lucide-react";

import { AlertMessage } from "@/components/auth/alert-message";
import { PriceField, TextField } from "@/components/ui/form-controls";
import { ModalShell } from "@/components/ui/modal-shell";

type OpenSessionModalProps = {
  formAction: (payload: FormData) => void;
  error?: string;
  isPending?: boolean;
  cashierName?: string;
  dismissible?: boolean;
  onClose?: () => void;
};

export function OpenSessionModal({
  formAction,
  error,
  isPending = false,
  cashierName,
  dismissible = false,
  onClose,
}: OpenSessionModalProps) {
  return (
    <ModalShell
      formId="open-session-form"
      title="Ouvrir la caisse"
      subtitle="Comptez le fond initial et démarrez votre session de service."
      onClose={onClose ?? (() => undefined)}
      dismissible={dismissible}
      onSubmit={(event) => {
        event.preventDefault();
        formAction(new FormData(event.currentTarget));
      }}
      footer={
        <div className="flex justify-end gap-2">
          {dismissible && onClose ? (
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
            >
              Plus tard
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Ouverture…" : "Ouvrir la caisse"}
          </button>
        </div>
      }
    >
      {cashierName ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Caissière connectée</p>
            <p className="text-sm font-semibold text-slate-900">{cashierName}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <AlertMessage message={error} />
        </div>
      ) : null}

      <div className="space-y-4">
        <PriceField
          id="openingCashAmount"
          name="openingCashAmount"
          label="Fond de caisse initial"
          hint="Montant en espèces présent en caisse au démarrage."
          required
          min={0}
          step={1}
          defaultValue={0}
          autoFocus
          disabled={isPending}
        />
        <TextField
          id="openingNote"
          name="openingNote"
          label="Note (facultatif)"
          placeholder="Ex. fond standard du matin"
          disabled={isPending}
        />
      </div>
    </ModalShell>
  );
}
