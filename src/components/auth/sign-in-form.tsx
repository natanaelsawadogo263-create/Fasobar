"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: AuthActionState = {};

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <AuthCard
      title="Connexion"
      description="Accédez à votre espace FasoBar."
      footer={
        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-medium text-emerald-700 hover:underline">
            Créer un compte
          </Link>
        </p>
      }
    >
      <form action={formAction} className="space-y-5">
        {state.error ? <AlertMessage message={state.error} /> : null}

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
          autoComplete="current-password"
          required
        />

        <div className="text-right">
          <Link
            href="/mot-de-passe-oublie"
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <SubmitButton label="Se connecter" pendingLabel="Connexion..." />
      </form>
    </AuthCard>
  );
}
