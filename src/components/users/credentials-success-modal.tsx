"use client";

import { useState } from "react";

import type { CreatedCredentialsSummary } from "@/lib/users/types";

type CredentialsSuccessModalProps = {
  summary: CreatedCredentialsSummary;
  onClose: () => void;
};

function buildCopyText(summary: CreatedCredentialsSummary): string {
  return [
    "FasoBar — Identifiants de connexion",
    "",
    `Nom : ${summary.fullName}`,
    `Identifiant FasoBar : ${summary.loginIdentifier}`,
    `Mot de passe temporaire : ${summary.temporaryPassword}`,
    `Espace : ${summary.spaceLabel}`,
    `Établissement : ${summary.establishmentName}`,
    "",
    "À votre première connexion, vous devrez créer un nouveau mot de passe.",
  ].join("\n");
}

export function CredentialsSuccessModal({
  summary,
  onClose,
}: CredentialsSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(buildCopyText(summary));
    setCopied(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Compte créé
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{summary.fullName}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Communiquez ces identifiants à l&apos;employé. Le mot de passe devra être changé
          à la première connexion avant toute utilisation hors ligne.
        </p>

        <dl className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div>
            <dt className="text-slate-500">Identifiant FasoBar</dt>
            <dd className="font-medium text-slate-900">{summary.loginIdentifier}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Mot de passe temporaire</dt>
            <dd className="font-mono font-medium text-slate-900">{summary.temporaryPassword}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Espace</dt>
            <dd className="font-medium text-slate-900">{summary.spaceLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Établissement</dt>
            <dd className="font-medium text-slate-900">{summary.establishmentName}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? "Identifiants copiés" : "Copier les identifiants"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
