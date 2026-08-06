"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUpAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: AuthActionState = {};

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  return (
    <AuthCard
      title="Inscription"
      description="Créez le compte du premier propriétaire de votre établissement."
      footer={
        <p className="text-center text-sm text-slate-600">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-medium text-emerald-700 hover:underline">
            Se connecter
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
          id="fullName"
          name="fullName"
          label="Nom complet"
          autoComplete="name"
          required
        />

        <FormField
          id="email"
          name="email"
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          required
        />

        <FormField
          id="password"
          name="password"
          label="Mot de passe"
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

        <label className="flex items-start gap-3 text-sm text-slate-600">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            required
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            J&apos;accepte les conditions d&apos;utilisation de FasoBar.
          </span>
        </label>

        <SubmitButton label="Créer mon compte" pendingLabel="Création..." />
      </form>
    </AuthCard>
  );
}
