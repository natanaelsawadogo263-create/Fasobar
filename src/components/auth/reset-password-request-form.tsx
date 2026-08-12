"use client";

import Link from "next/link";
import { type FormEvent, useState, useTransition } from "react";

import { generatePasswordRecoveryLinkAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { AlertMessage } from "@/components/auth/alert-message";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { isInternalFasoBarAuthEmail } from "@/lib/auth/login-identifier";
import { createClient } from "@/lib/supabase/client";

type ResetPasswordRequestFormProps = {
  defaultEmail?: string;
};

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function resolveRecoveryLink(email: string): Promise<string | null> {
  const result = await generatePasswordRecoveryLinkAction(email);
  return result.recoveryLink ?? null;
}

export function ResetPasswordRequestForm({
  defaultEmail = "",
}: ResetPasswordRequestFormProps) {
  const [state, setState] = useState<AuthActionState>({});
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();

    startTransition(async () => {
      setState({});

      if (!email || !email.includes("@")) {
        setState({ error: "Adresse e-mail invalide." });
        return;
      }

      if (isInternalFasoBarAuthEmail(email)) {
        setState({
          error:
            "Les comptes employés doivent passer par l'administrateur (Utilisateurs).",
        });
        return;
      }

      // Local: lien direct (évite le quota e-mail Supabase).
      if (isLocalHost()) {
        const link = await resolveRecoveryLink(email);
        if (link) {
          window.location.assign(link);
          return;
        }
      }

      const origin = window.location.origin;
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/nouveau-mot-de-passe")}`,
      });

      if (!error) {
        setState({
          success:
            "Si un compte existe, un e-mail de réinitialisation a été envoyé.",
        });
        return;
      }

      const rateLimited =
        error.code === "over_email_send_rate_limit" ||
        error.message.toLowerCase().includes("email rate limit");

      if (rateLimited) {
        const link = await resolveRecoveryLink(email);
        if (link) {
          window.location.assign(link);
          return;
        }
        setState({
          error: "Trop d'e-mails envoyés. Réessayez dans une heure.",
        });
        return;
      }

      setState({
        error: "Impossible d'envoyer le lien. Réessayez plus tard.",
      });
    });
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez l’e-mail de votre compte pour recevoir un lien sécurisé."
      footer={
        <p className="text-center text-sm text-slate-600">
          <Link href="/connexion" className="font-medium text-emerald-700 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {state.error ? (
          <AlertMessage message={state.error} dismissible={false} />
        ) : null}
        {state.success ? (
          <AlertMessage message={state.success} tone="success" dismissible={false} />
        ) : null}

        <FormField
          id="email"
          name="email"
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
        />

        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Envoi..." : "Envoyer le lien"}
        </button>
      </form>
    </AuthCard>
  );
}
