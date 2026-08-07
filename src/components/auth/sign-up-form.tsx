"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signUpAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";

const initialState: AuthActionState = {};

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialState);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-3xl border border-slate-200/80 bg-white px-7 py-9 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)] sm:px-9 sm:py-10">
        <header className="text-center">
          <div className="flex justify-center">
            <FasoBarLogo size="md" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Étape 1 sur 2
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Créer un établissement
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Commencez par votre compte propriétaire. Les informations de
            l&apos;établissement seront demandées juste après.
          </p>
        </header>

        <form action={formAction} className="mt-8 space-y-4">
          {state.error ? <AlertMessage message={state.error} /> : null}
          {state.success ? (
            <AlertMessage message={state.success} tone="success" />
          ) : null}

          <FormField
            id="fullName"
            name="fullName"
            label="Nom complet"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <FormField
            id="email"
            name="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <FormField
            id="password"
            name="password"
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            hint="Minimum 10 caractères"
            required
          />

          <FormField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            required
          />

          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input
              id="acceptTerms"
              name="acceptTerms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              required
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>J&apos;accepte les conditions d&apos;utilisation.</span>
          </label>

          <SubmitButton label="Continuer" pendingLabel="Création..." />
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Déjà un compte ?{" "}
          <Link href="/" className="font-medium text-emerald-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
