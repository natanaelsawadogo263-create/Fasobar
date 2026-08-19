import type { ReactNode } from "react";
import {
  Building2,
  Clock3,
  Mail,
  MessageCircle,
  ShieldAlert,
  Store,
  UserRound,
} from "lucide-react";

import { OpeningStatusPoller } from "@/components/auth/opening-status-poller";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { whatsappHref } from "@/lib/marketing/config";

type AttenteValidationScreenProps = {
  refused: boolean;
  ownerName: string;
  establishmentName: string;
  organizationName: string;
  email: string | null;
  activityLabel: string | null;
  requestedAt: string | null;
};

function formatRequestedAt(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AttenteValidationScreen({
  refused,
  ownerName,
  establishmentName,
  organizationName,
  email,
  activityLabel,
  requestedAt,
}: AttenteValidationScreenProps) {
  const showOrganization =
    organizationName.trim() !== "" &&
    organizationName.trim().toLowerCase() !==
      establishmentName.trim().toLowerCase();
  const requestedLabel = formatRequestedAt(requestedAt);
  const whatsappMessage = refused
    ? `Bonjour, ma demande d’ouverture FasoBar pour « ${establishmentName} » a été refusée. Pouvez-vous m’aider ?`
    : `Bonjour, ma demande d’ouverture FasoBar pour « ${establishmentName} » est en attente de confirmation Super Admin.`;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-12 w-full max-w-xl items-center justify-between px-4">
          <FasoBarLogo size="sm" />
          <SignOutButton variant="ghost" compact />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                refused
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {refused ? (
                <ShieldAlert className="h-5 w-5" aria-hidden />
              ) : (
                <Clock3 className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  refused ? "text-red-700" : "text-amber-700"
                }`}
              >
                {refused ? "Dossier non validé" : "Dossier en revue"}
              </p>
              <h1 className="mt-0.5 text-[18px] font-semibold tracking-tight text-slate-900">
                {refused
                  ? "Ouverture non confirmée"
                  : "Confirmation Super Admin"}
              </h1>
              <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
                {refused ? (
                  <>
                    La demande pour{" "}
                    <span className="font-medium text-slate-900">
                      {establishmentName}
                    </span>{" "}
                    n&apos;a pas été acceptée. Contactez-nous en cas d&apos;erreur.
                  </>
                ) : (
                  <>
                    Merci{" "}
                    <span className="font-medium text-slate-900">{ownerName}</span>
                    . La demande pour{" "}
                    <span className="font-medium text-slate-900">
                      {establishmentName}
                    </span>{" "}
                    est transmise. L&apos;accès s&apos;ouvre après confirmation.
                  </>
                )}
              </p>
              {requestedLabel ? (
                <p className="mt-1 text-[12px] text-slate-500">
                  Envoyée le {requestedLabel}.
                </p>
              ) : null}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <InfoRow
              icon={<Store className="h-3.5 w-3.5" />}
              label="Commerce"
              value={establishmentName}
            />
            {activityLabel ? (
              <InfoRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Activité"
                value={activityLabel}
              />
            ) : null}
            <InfoRow
              icon={<UserRound className="h-3.5 w-3.5" />}
              label="Compte"
              value={ownerName}
            />
            {email ? (
              <InfoRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label="E-mail"
                value={email}
              />
            ) : null}
            {showOrganization ? (
              <InfoRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Organisation"
                value={organizationName}
              />
            ) : null}
          </dl>

          {!refused ? (
            <p className="mt-3 text-[12px] leading-snug text-slate-500">
              Cette page se met à jour seule. Aucune action n&apos;est requise.
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={whatsappHref(whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-[14px] font-semibold text-white transition hover:bg-emerald-800"
            >
              <MessageCircle className="h-4 w-4" />
              Contacter FasoBar
            </a>
            <OpeningStatusPoller enabled={!refused} />
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 truncate pl-[22px] text-[14px] font-medium text-slate-900">
        {value}
      </dd>
    </div>
  );
}
