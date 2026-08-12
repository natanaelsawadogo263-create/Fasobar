"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { signInAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";

const initialState: AuthActionState = {};

type SignInFormProps = {
  /** Desktop SERVEUR_CAISSE — identifiant FasoBar + indicateur online/offline. */
  desktopMode?: boolean;
  initialCloudReachable?: boolean | null;
  /** Erreur affichée avant toute tentative de connexion (ex. lien e-mail invalide). */
  authError?: string | null;
};

export function SignInForm({
  desktopMode = false,
  initialCloudReachable = null,
  authError = null,
}: SignInFormProps) {
  const [state, formAction] = useActionState(signInAction, initialState);
  const [cloudReachable, setCloudReachable] = useState(initialCloudReachable);

  useEffect(() => {
    if (!desktopMode) {
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const response = await fetch("/api/desktop/health", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const json = (await response.json()) as {
          connectivity?: { cloudReachable?: boolean };
        };
        if (!cancelled && typeof json.connectivity?.cloudReachable === "boolean") {
          setCloudReachable(json.connectivity.cloudReachable);
        }
      } catch {
        if (!cancelled) {
          setCloudReachable(false);
        }
      }
    };

    void tick();
    const id = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [desktopMode]);

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
            {desktopMode
              ? "Entrez votre identifiant FasoBar et votre mot de passe."
              : "Entrez vos identifiants pour accéder à votre espace."}
          </p>
          {desktopMode ? (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  cloudReachable === false ? "bg-amber-500" : "bg-emerald-500"
                }`}
                aria-hidden
              />
              {cloudReachable === false ? "Mode hors connexion" : "En ligne"}
            </p>
          ) : null}
        </header>

        <form action={formAction} className="mt-8 space-y-4">
          {authError ? <AlertMessage message={authError} /> : null}
          {state.error ? <AlertMessage message={state.error} /> : null}

          {desktopMode ? (
            <FormField
              id="identifier"
              name="identifier"
              label="Identifiant FasoBar"
              type="text"
              autoComplete="username"
              required
            />
          ) : (
            <FormField
              id="email"
              name="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              required
            />
          )}

          <FormField
            id="password"
            name="password"
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
          />

          <SubmitButton label="Se connecter" pendingLabel="Connexion..." />
        </form>

        {!desktopMode ? (
          <p className="mt-4 text-right">
            <Link
              href="/mot-de-passe-oublie"
              className="text-sm font-medium text-emerald-700 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </p>
        ) : (
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
            Mot de passe oublié ? Demandez une réinitialisation à votre
            administrateur (menu Utilisateurs).
          </p>
        )}

        {!desktopMode ? (
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
        ) : null}
      </div>
    </div>
  );
}
