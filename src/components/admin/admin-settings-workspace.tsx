"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  Building2,
  KeyRound,
  LayoutGrid,
  Package,
  Receipt,
  ShieldAlert,
  Store,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { updateEstablishmentSettingsAction } from "@/app/(protected)/application/parametres/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { EstablishmentLogoField } from "@/components/admin/establishment-logo-field";
import { NumberField, SelectField, TextField } from "@/components/ui/form-controls";
import { generatePasswordRecoveryLinkAction } from "@/lib/auth/actions";
import { isInternalFasoBarAuthEmail } from "@/lib/auth/login-identifier";
import type { EstablishmentSettings } from "@/lib/settings/types";
import {
  SERVICE_SCOPE_OPTIONS,
  type ServiceScope,
} from "@/lib/settings/service-scope";
import { createClient } from "@/lib/supabase/client";

type AdminSettingsWorkspaceProps = {
  settings: EstablishmentSettings | null;
  migrationMissing: boolean;
  organizationName: string;
  establishmentName: string;
  ownerEmail: string;
};

type SettingsSection = "general" | "spaces" | "receipt" | "stock" | "security";

const CURRENCY_OPTIONS = [
  { value: "XOF", label: "Franc CFA — XOF" },
  { value: "GHS", label: "Cedi ghanéen — GHS" },
  { value: "NGN", label: "Naira — NGN" },
  { value: "EUR", label: "Euro — EUR" },
  { value: "USD", label: "Dollar US — USD" },
];

const TIMEZONE_OPTIONS = [
  { value: "Africa/Ouagadougou", label: "Ouagadougou (UTC+0)" },
  { value: "Africa/Abidjan", label: "Abidjan (UTC+0)" },
  { value: "Africa/Accra", label: "Accra (UTC+0)" },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)" },
];

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "general",
    label: "Établissement",
    description: "Identité et coordonnées",
    icon: Store,
  },
  {
    id: "spaces",
    label: "Espaces",
    description: "Boissons, nourriture ou les deux",
    icon: LayoutGrid,
  },
  {
    id: "receipt",
    label: "Reçu de caisse",
    description: "Logo et textes d'impression",
    icon: Receipt,
  },
  {
    id: "stock",
    label: "Stock",
    description: "Seuil par défaut",
    icon: Package,
  },
  {
    id: "security",
    label: "Sécurité",
    description: "Mot de passe & accès",
    icon: ShieldAlert,
  },
];

export function AdminSettingsWorkspace({
  settings,
  migrationMissing,
  organizationName,
  establishmentName,
  ownerEmail,
}: AdminSettingsWorkspaceProps) {
  const [section, setSection] = useState<SettingsSection>("general");
  const [serviceScope, setServiceScope] = useState<ServiceScope>(
    settings?.serviceScope ?? "BOTH",
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateEstablishmentSettingsAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Paramètres enregistrés.");
    });
  }

  function handleOwnerPasswordReset() {
    const email = ownerEmail.trim().toLowerCase();
    if (!email) {
      setError("Adresse e-mail administrateur introuvable.");
      return;
    }

    if (isInternalFasoBarAuthEmail(email)) {
      setError("Utilisez Utilisateurs pour les comptes employés.");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const host = window.location.hostname;
      const isLocal = host === "localhost" || host === "127.0.0.1";

      if (isLocal) {
        const direct = await generatePasswordRecoveryLinkAction(email);
        if (direct.recoveryLink) {
          window.location.assign(direct.recoveryLink);
          return;
        }
      }

      const origin = window.location.origin;
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/nouveau-mot-de-passe")}`,
        },
      );

      if (!resetError) {
        setSuccess("E-mail de réinitialisation envoyé.");
        return;
      }

      const rateLimited =
        resetError.code === "over_email_send_rate_limit" ||
        resetError.message.toLowerCase().includes("email rate limit");

      if (rateLimited) {
        const fallback = await generatePasswordRecoveryLinkAction(email);
        if (fallback.recoveryLink) {
          window.location.assign(fallback.recoveryLink);
          return;
        }
        setError("Trop d'e-mails envoyés. Réessayez dans une heure.");
        return;
      }

      setError("Impossible d'envoyer l'e-mail de réinitialisation.");
    });
  }

  const showSaveBar = !migrationMissing && section !== "security";

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-4 py-3 lg:gap-3.5 lg:px-5 lg:py-4">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Paramètres
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Configuration de{" "}
            <span className="font-medium text-slate-700">{establishmentName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-600 shadow-sm">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-slate-800">{organizationName}</span>
        </div>
      </header>

      {error ? <AlertMessage message={error} /> : null}
      {success ? (
        <AlertMessage
          message={success}
          tone="success"
          onDismiss={() => setSuccess(null)}
        />
      ) : null}

      <div className="grid min-h-0 gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-3.5">
        <nav
          aria-label="Sections paramètres"
          className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-sm lg:flex-col lg:overflow-visible lg:p-2"
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex min-h-11 min-w-[140px] items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition lg:min-h-0 lg:min-w-0 lg:items-start ${
                  active
                    ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                    : "text-slate-600 active:bg-slate-50 sm:hover:bg-slate-50 sm:hover:text-slate-900"
                }`}
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold">{item.label}</span>
                  <span className="mt-0.5 hidden text-[11px] text-slate-500 lg:block">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          {section === "security" ? (
            <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <SectionHeader
                title="Sécurité du compte"
                description="Mot de passe administrateur et accès employés."
              />
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-900">
                        Mot de passe administrateur
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                        Un lien de réinitialisation sera envoyé à{" "}
                        <span className="font-medium text-slate-700">
                          {ownerEmail || "votre adresse e-mail"}
                        </span>
                        .
                      </p>
                      <button
                        type="button"
                        disabled={isPending || !ownerEmail.trim()}
                        onClick={handleOwnerPasswordReset}
                        className="mt-3 inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:text-[12px] sm:hover:bg-slate-50"
                      >
                        {isPending
                          ? "Envoi du lien..."
                          : "Réinitialiser mon mot de passe"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80">
                      <ShieldAlert className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-900">
                        Mots de passe employés
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                        Pour réinitialiser un mot de passe temporaire, ouvrez{" "}
                        <Link
                          href="/application/utilisateurs"
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          Utilisateurs
                        </Link>
                        . FasoBar ne conserve jamais les mots de passe en clair.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : migrationMissing ? (
            <div className="flex flex-1 items-start gap-3 p-5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Migration paramètres non appliquée
                </h2>
                <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-slate-600">
                  Les colonnes de configuration (adresse, reçu, devise, fuseau, seuil de
                  stock) ne sont pas encore disponibles sur cette base. Une fois la
                  migration appliquée, ce formulaire apparaîtra automatiquement.
                </p>
              </div>
            </div>
          ) : (
            <form
              action={handleSubmit}
              noValidate
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                {/* All settings fields stay mounted so edits persist across sections */}
                <div className={section === "general" ? "space-y-6" : "hidden"}>
                  <SectionHeader
                    title="Établissement"
                    description="Informations affichées dans l'application et sur les documents."
                  />

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Organisation
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-slate-900">
                      {organizationName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      Définie à la création du compte — contactez le support pour la
                      modifier.
                    </p>
                  </div>

                  <TextField
                    id="name"
                    name="name"
                    label="Nom de l'établissement"
                    defaultValue={settings?.name ?? establishmentName}
                    required
                  />

                  <div>
                    <p className="mb-3 text-[13px] font-semibold text-slate-900">
                      Coordonnées
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        id="address"
                        name="address"
                        label="Quartier"
                        placeholder="Ex. Ouaga 2000, Zone 1…"
                        defaultValue={settings?.address ?? ""}
                      />
                      <TextField
                        id="phone"
                        name="phone"
                        label="Téléphone"
                        defaultValue={settings?.phone ?? ""}
                        placeholder="Ex. +226 70 00 00 00"
                      />
                      <SelectField
                        id="currency"
                        name="currency"
                        label="Devise"
                        defaultValue={settings?.currency ?? "XOF"}
                      >
                        {CURRENCY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                      <SelectField
                        id="timezone"
                        name="timezone"
                        label="Fuseau horaire"
                        defaultValue={settings?.timezone ?? "Africa/Ouagadougou"}
                      >
                        {TIMEZONE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                </div>

                <div className={section === "spaces" ? "space-y-6" : "hidden"}>
                  <SectionHeader
                    title="Espaces de l’établissement"
                    description="Choisissez si FasoBar gère les boissons, la nourriture, ou les deux."
                  />
                  <input type="hidden" name="serviceScope" value={serviceScope} />
                  <div className="grid gap-3">
                    {SERVICE_SCOPE_OPTIONS.map((option) => {
                      const selected = serviceScope === option.id;
                      const Icon =
                        option.id === "BAR"
                          ? Wine
                          : option.id === "KITCHEN"
                            ? UtensilsCrossed
                            : LayoutGrid;
                      return (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                            selected
                              ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/15"
                              : "border-slate-200 bg-white hover:border-emerald-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="serviceScopeChoice"
                            value={option.id}
                            checked={selected}
                            onChange={() => setServiceScope(option.id)}
                            className="sr-only"
                          />
                          <span
                            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              selected
                                ? "bg-emerald-600 text-white"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <Icon className="h-5 w-5" strokeWidth={2} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-semibold text-slate-900">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-slate-500">
                    Ce choix masque les menus, produits et comptes employés qui ne
                    correspondent pas à votre activité.
                  </p>
                </div>

                <div className={section === "receipt" ? "space-y-6" : "hidden"}>
                  <SectionHeader
                    title="Reçu de caisse"
                    description="Logo et textes imprimés sur les reçus et additions."
                  />
                  <EstablishmentLogoField existingUrl={settings?.logoUrl} />
                  <TextField
                    id="receiptHeader"
                    name="receiptHeader"
                    label="En-tête du reçu"
                    defaultValue={settings?.receiptHeader ?? ""}
                    placeholder="Ex. Maquis FasoBar — Bienvenue"
                  />
                  <TextField
                    id="receiptFooter"
                    name="receiptFooter"
                    label="Pied de reçu"
                    defaultValue={settings?.receiptFooter ?? ""}
                    placeholder="Ex. TVA non applicable"
                  />
                  <TextField
                    id="thankYouMessage"
                    name="thankYouMessage"
                    label="Message de remerciement"
                    defaultValue={settings?.thankYouMessage ?? ""}
                    placeholder="Ex. Merci de votre visite, à bientôt !"
                  />
                </div>

                <div className={section === "stock" ? "space-y-6" : "hidden"}>
                  <SectionHeader
                    title="Stock"
                    description="Seuil minimum appliqué par défaut aux nouveaux articles bar."
                  />
                  <div className="max-w-xs">
                    <NumberField
                      id="defaultMinimumStock"
                      name="defaultMinimumStock"
                      label="Seuil de stock par défaut"
                      defaultValue={String(settings?.defaultMinimumStock ?? 5)}
                      min={0}
                      required
                    />
                  </div>
                  <p className="text-[12px] text-slate-500">
                    Ce seuil sert de valeur initiale. Vous pouvez ensuite l&apos;ajuster
                    article par article.
                  </p>
                </div>
              </div>

              {showSaveBar ? (
                <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:px-6">
                  <p className="hidden text-[12px] text-slate-500 sm:block">
                    Les modifications s&apos;appliquent immédiatement après enregistrement.
                  </p>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="ml-auto inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:h-10 sm:w-auto sm:hover:bg-emerald-700"
                  >
                    {isPending ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </footer>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-[12px] text-slate-500">{description}</p>
    </div>
  );
}
