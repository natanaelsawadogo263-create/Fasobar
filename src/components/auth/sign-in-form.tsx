"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";

const initialState: AuthActionState = {};

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-3xl border border-slate-200/80 bg-white px-7 py-9 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)] sm:px-9 sm:py-10">
        <header className="text-center">
          <div className="flex justify-center">
            <FasoBarLogo size="md" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Connexion
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Entrez vos identifiants pour accéder à votre espace.
          </p>
        </header>

        <form action={formAction} className="mt-8 space-y-4">
          {state.error ? <AlertMessage message={state.error} /> : null}

          <FormField
            id="email"
            name="email"
            label="E-mail"
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

          <div className="flex justify-end">
            <Link
              href="/mot-de-passe-oublie"
              className="text-sm font-medium text-emerald-700 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <SubmitButton label="Se connecter" pendingLabel="Connexion..." />
        </form>

        <div className="mt-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-[0.14em] text-slate-400">
              <span className="bg-white px-3">Nouveau sur FasoBar</span>
            </div>
          </div>

          <Link
            href="/inscription"
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            Créer un établissement
          </Link>
        </div>
      </div>
    </div>
  );
}
