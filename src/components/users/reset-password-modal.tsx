"use client";

import { useState, useTransition } from "react";

import { resetTemporaryPasswordAction } from "@/app/(protected)/application/utilisateurs/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { CredentialsSuccessModal } from "@/components/users/credentials-success-modal";
import { PasswordField } from "@/components/users/password-field";
import type { CreatedCredentialsSummary, TeamMemberRow } from "@/lib/users/types";
import { ModalShell } from "@/components/ui/modal-shell";

type ResetPasswordModalProps = {
  member: TeamMemberRow;
  onClose: () => void;
  onReset: () => void;
};

export function ResetPasswordModal({ member, onClose, onReset }: ResetPasswordModalProps) {
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordConfirmation, setTemporaryPasswordConfirmation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<CreatedCredentialsSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("userId", member.userId);
    formData.set("temporaryPassword", temporaryPassword);
    formData.set("temporaryPasswordConfirmation", temporaryPasswordConfirmation);
    formData.set("confirmed", confirmed ? "true" : "false");

    startTransition(async () => {
      const result = await resetTemporaryPasswordAction({}, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccessSummary({
        fullName: member.fullName,
        loginIdentifier: member.loginIdentifier,
        spaceLabel: member.spaceLabel,
        establishmentName: member.establishmentName,
        temporaryPassword,
      });
      setTemporaryPassword("");
      setTemporaryPasswordConfirmation("");
      onReset();
    });
  }

  if (successSummary) {
    return (
      <CredentialsSuccessModal
        summary={successSummary}
        onClose={() => {
          setSuccessSummary(null);
          onClose();
        }}
      />
    );
  }

  return (
    <ModalShell
      formId="reset-password-form"
      title="Créer un nouveau mot de passe temporaire"
      subtitle={`Réinitialisez l'accès de ${member.fullName}.`}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="reset-password-form"
            disabled={isPending || !confirmed}
            aria-busy={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Réinitialisation..." : "Réinitialiser"}
          </button>
        </div>
      }
    >
      {error ? <AlertMessage message={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField
          id="temporaryPassword"
          name="temporaryPassword"
          label="Nouveau mot de passe temporaire"
          value={temporaryPassword}
          onChange={setTemporaryPassword}
          showStrength
          required
        />
        <PasswordField
          id="temporaryPasswordConfirmation"
          name="temporaryPasswordConfirmation"
          label="Confirmation"
          value={temporaryPasswordConfirmation}
          onChange={setTemporaryPasswordConfirmation}
          required
        />
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4 accent-emerald-700"
        />
        <span>
          Je confirme la réinitialisation. L&apos;employé devra changer ce mot de passe à
          sa prochaine connexion.
        </span>
      </label>
    </ModalShell>
  );
}
