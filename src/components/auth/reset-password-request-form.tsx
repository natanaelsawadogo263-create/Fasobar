"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordRequestAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: AuthActionState = {};

export function ResetPasswordRequestForm() {
  const [state, formAction] = useActionState(resetPasswordRequestAction, initialState);

  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Recevez un lien sécurisé pour définir un nouveau mot de passe."
      footer={
        <p className="text-center text-sm text-slate-600">
          <Link href="/" className="font-medium text-emerald-700 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <form action={formAction} className="space-y-5">
        {state.error ? <AlertMessage message={state.error} /> : null}
        {state.success ? (
          <AlertMessage message={state.success} tone="success" />
        ) : null}

        <FormField
          id="email"
          name="email"
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          required
        />

        <SubmitButton label="Envoyer le lien" pendingLabel="Envoi..." />
      </form>
    </AuthCard>
  );
}
