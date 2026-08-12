"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { LockKeyhole } from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";

import {
  completeFirstLoginAction,
  type FirstLoginActionState,
} from "@/app/(protected)/premiere-connexion/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { PasswordField } from "@/components/users/password-field";
import type { FirstLoginContext } from "@/lib/users/types";

const initialState: FirstLoginActionState = {};

type FirstLoginFormProps = {
  context: FirstLoginContext;
};

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function FirstLoginSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Enregistrement..." : "Enregistrer mon mot de passe"}
    </button>
  );
}

export function FirstLoginForm({ context }: FirstLoginFormProps) {
  const [state, formAction] = useActionState(completeFirstLoginAction, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <div className="flex h-full max-h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between bg-[#0b1220] px-5 py-4 text-white md:w-[42%] md:px-6 md:py-6">
        <div>
          <FasoBarLogo size="sm" tone="dark" />

          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <LockKeyhole className="h-3 w-3" />
            Première connexion
          </span>

          <h1 className="mt-3 text-[22px] font-bold leading-tight tracking-tight">
            Sécurisez votre compte
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
            Avant d&apos;accéder à FasoBar, créez votre mot de passe personnel.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-300">
              {getInitials(context.fullName)}
            </span>
            <div className="min-w-0 flex-1 break-words">
              <p className="text-[14px] font-semibold leading-snug text-white">
                {context.fullName}
              </p>
              <p className="mt-1 break-all text-[12px] leading-snug text-slate-300">
                {context.loginIdentifier}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-slate-200">
                <span className="font-medium">{context.establishmentName}</span>
                <span className="text-slate-500"> · </span>
                <span className="font-semibold text-emerald-300">{context.spaceLabel}</span>
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col justify-center px-5 py-5 sm:px-7 sm:py-6">
        <div className="mb-4">
          <h2 className="text-[16px] font-bold text-slate-900">Nouveau mot de passe</h2>
          <p className="mt-1 text-[12px] leading-snug text-slate-500">
            Au moins 10 caractères, avec majuscule, minuscule, chiffre et caractère spécial.
          </p>
        </div>

        <form action={formAction} className="space-y-3">
          {state.error ? <AlertMessage message={state.error} /> : null}

          <PasswordField
            id="password"
            name="password"
            label="Nouveau mot de passe"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            showStrength
            compact
            required
          />

          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmation du nouveau mot de passe"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            compact
            required
          />

          <div className="pt-1">
            <FirstLoginSubmit />
          </div>
        </form>
      </section>
    </div>
  );
}
