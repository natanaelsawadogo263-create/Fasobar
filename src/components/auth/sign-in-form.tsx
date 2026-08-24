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
    <div className="w-full max-w-[400px]">
      <div className="rounded-3xl border border-slate-200/80 bg-white px-7 py-5 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)] sm:px-8 sm:py-6">
        <header className="text-center">
          <div className="flex justify-center">
            <FasoBarLogo size="md" markSize={72} markOnly />
          </div>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">
            Connexion
          </h1>
          {desktopMode ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
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

        <form action={formAction} className="mt-5 space-y-3">
          {authError ? <AlertMessage message={authError} /> : null}
          {state.error ? <AlertMessage message={state.error} /> : null}

          <FormField
            id="identifier"
            name="identifier"
            label={desktopMode ? "Identifiant FasoBar" : "Identifiant ou e-mail"}
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
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

          {!desktopMode ? (
            <p className="!mt-1.5 text-right">
              <Link
                href="/mot-de-passe-oublie"
                className="text-[12.5px] font-medium text-emerald-700 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </p>
          ) : (
            <p className="!mt-1.5 text-center text-[11.5px] leading-relaxed text-slate-500">
              Mot de passe oublié ? Demandez une réinitialisation à votre
              administrateur (menu Utilisateurs).
            </p>
          )}

          <SubmitButton label="Se connecter" pendingLabel="Connexion..." />
        </form>

        {!desktopMode ? (
          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-[12.5px] text-slate-500">
            Nouveau sur FasoBar ?{" "}
            <Link
              href="/inscription/activite"
              className="font-semibold text-emerald-700 hover:underline"
            >
              Créer un établissement
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
