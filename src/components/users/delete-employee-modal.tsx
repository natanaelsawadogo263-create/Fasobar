"use client";

import { useState, useTransition } from "react";

import { deleteEmployeeAccountAction } from "@/app/(protected)/application/utilisateurs/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { ToggleField } from "@/components/ui/form-controls";
import { ModalShell } from "@/components/ui/modal-shell";
import type { TeamMemberRow } from "@/lib/users/types";

type DeleteEmployeeModalProps = {
  member: TeamMemberRow;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteEmployeeModal({
  member,
  onClose,
  onDeleted,
}: DeleteEmployeeModalProps) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("userId", member.userId);
    formData.set("reason", reason);
    formData.set("confirmed", confirmed ? "true" : "false");

    startTransition(async () => {
      const result = await deleteEmployeeAccountAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDeleted();
      onClose();
    });
  }

  return (
    <ModalShell
      formId="delete-employee-form"
      title="Supprimer le compte employé"
      subtitle={`${member.fullName} · ${member.email}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending || !confirmed || reason.trim().length < 3}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Suppression…" : "Confirmer la suppression"}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4">
          <AlertMessage message={error} />
        </div>
      ) : null}

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
        L&apos;accès sera retiré définitivement. L&apos;historique des commandes et
        paiements reste conservé pour la comptabilité.
      </div>

      <label htmlFor="delete-reason" className="block text-sm font-medium text-slate-700">
        Motif de suppression
      </label>
      <textarea
        id="delete-reason"
        name="reason"
        required
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        placeholder="Ex. départ de l'employé, compte créé par erreur…"
      />

      <div className="mt-4">
        <ToggleField
          id="delete-confirmed"
          name="confirmed"
          label="Je confirme la suppression de ce compte"
          checked={confirmed}
          onChange={setConfirmed}
        />
      </div>
    </ModalShell>
  );
}
