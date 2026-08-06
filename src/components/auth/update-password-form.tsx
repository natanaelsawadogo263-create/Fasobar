"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: AuthActionState = {};

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialState);

  return (
    <AuthCard
      title="Nouveau mot de passe"
      description="Choisissez un mot de passe sécurisé pour votre compte FasoBar."
    >
      <form action={formAction} className="space-y-5">
        {state.error ? <AlertMessage message={state.error} /> : null}

        <FormField
          id="password"
          name="password"
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          hint="Au moins 10 caractères."
          required
        />

        <FormField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirmation du mot de passe"
          type="password"
          autoComplete="new-password"
          required
        />

        <SubmitButton label="Enregistrer" pendingLabel="Enregistrement..." />
      </form>
    </AuthCard>
  );
}
