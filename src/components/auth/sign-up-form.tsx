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

type SignUpFormProps = {
  activityLabel?: string;
};

export function SignUpForm({ activityLabel }: SignUpFormProps) {
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
            Étape 2 sur 3
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Créer un établissement
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Commencez par votre compte propriétaire. Les informations de
            l&apos;établissement seront demandées juste après.
          </p>
        </header>

        {activityLabel ? (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3">
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                Activité
              </p>
              <p className="mt-0.5 truncate text-[13px] font-medium text-slate-900">
                {activityLabel}
              </p>
            </div>
            <Link
              href="/inscription/activite"
              className="shrink-0 text-[12px] font-semibold text-emerald-800 hover:underline"
            >
              Modifier
            </Link>
          </div>
        ) : null}

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
            <span>
              J&apos;accepte les{" "}
              <Link href="/conditions-utilisation" className="font-medium text-emerald-700 hover:underline">
                conditions d&apos;utilisation
              </Link>
              .
            </span>
          </label>

          <SubmitButton label="Continuer" pendingLabel="Création..." />
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-medium text-emerald-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
