"use client";

import { useState, useTransition } from "react";

import {
  resendSignUpConfirmationAction,
  verifySignUpCodeAction,
} from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";

/** Saisie du code de confirmation reçu par e-mail, avec renvoi du code. */
export function ConfirmSignUpCode({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [verifyState, setVerifyState] = useState<AuthActionState>({});
  const [resendState, setResendState] = useState<AuthActionState>({});
  const [isVerifying, startVerify] = useTransition();
  const [isResending, startResend] = useTransition();

  function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startVerify(async () => {
      setVerifyState({});
      setResendState({});
      // En cas de succès, l'action redirige : on ne revient ici qu'en erreur.
      setVerifyState(await verifySignUpCodeAction(email, code));
    });
  }

  function handleResend() {
    startResend(async () => {
      setVerifyState({});
      setResendState({});
      setResendState(await resendSignUpConfirmationAction(email));
    });
  }

  const error = verifyState.error ?? resendState.error;

  return (
    <div className="space-y-3 text-left">
      {error ? <AlertMessage message={error} /> : null}
      {resendState.success ? (
        <AlertMessage message={resendState.success} tone="success" />
      ) : null}

      <form onSubmit={handleVerify} className="space-y-3">
        <label htmlFor="signup-code" className="block text-sm font-medium text-slate-700">
          Code de confirmation
        </label>
        <input
          id="signup-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^\d\s]/g, ""))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="12345678"
          maxLength={12}
          required
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="submit"
          disabled={isVerifying || code.replace(/\s/g, "").length < 6}
          aria-busy={isVerifying}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVerifying ? "Vérification..." : "Valider et continuer"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={isResending}
        aria-busy={isResending}
        className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isResending ? "Envoi..." : "Renvoyer un code"}
      </button>
    </div>
  );
}
