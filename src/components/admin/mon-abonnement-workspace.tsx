"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { CreditCard, RefreshCw } from "lucide-react";

import { SubscriptionExpiryBanner } from "@/components/abonnement/subscription-expiry-banner";
import type { AbonnementPageData } from "@/lib/abonnement/queries";
import {
  PLATFORM_REQUEST_STATUS_LABELS,
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
  daysUntil,
  getSubscriptionExpiryAlert,
} from "@/lib/platform/access";
import {
  PLATFORM_ACCESS_STATUS_LABELS,
  PLATFORM_ACCESS_STATUS_STYLES,
} from "@/lib/platform/statuses";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatXof(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

function formatOrangeMoneyNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national =
    digits.startsWith("226") && digits.length >= 11
      ? digits.slice(3, 11)
      : digits.length >= 8
        ? digits.slice(-8)
        : digits;
  if (national.length === 8) {
    return `+226 ${national.slice(0, 2)} ${national.slice(2, 4)} ${national.slice(4, 6)} ${national.slice(6, 8)}`;
  }
  return raw.trim() || "+226 57 53 72 99";
}

type Props = {
  data: AbonnementPageData;
  canRenew: boolean;
};

export function MonAbonnementWorkspace({ data, canRenew }: Props) {
  const statusStyle =
    PLATFORM_ACCESS_STATUS_STYLES[data.access.status] ??
    "bg-slate-100 text-slate-700 ring-slate-200";

  const endsAt =
    data.currentSubscription?.endsAt ?? data.trialEndsAt ?? null;
  const daysLeft = endsAt ? daysUntil(endsAt) : null;
  const expiryAlert = getSubscriptionExpiryAlert({
    status: data.access.status,
    expiresAt: endsAt ?? data.access.expiresAt,
  });
  const openRequest = data.openRequest;
  const awaitingReview =
    openRequest != null &&
    (openRequest.status === "PAYMENT_SUBMITTED" ||
      openRequest.status === "UNDER_REVIEW");
  const needsPaymentAction =
    openRequest != null &&
    (openRequest.status === "PENDING_PAYMENT" ||
      openRequest.status === "NEEDS_NEW_PROOF");
  const showDeposit = canRenew && !awaitingReview;
  const renewHref = "/abonnement?renouveler=1";
  const renewLabel =
    data.access.status === "TRIAL"
      ? "Passer à un abonnement"
      : data.access.status === "ACTIVE"
        ? "Renouveler"
        : "Réactiver";
  const depositNumber = formatOrangeMoneyNumber(
    openRequest?.orangeMoneyNumber ||
      data.orangeMoneyNumber ||
      "+22657537299",
  );

  const endLabel = data.currentSubscription
    ? "Fin d’abonnement"
    : data.trialEndsAt
      ? "Fin d’essai"
      : "Échéance";
  const endValue = data.currentSubscription
    ? formatDate(data.currentSubscription.endsAt)
    : formatDate(data.trialEndsAt);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f8fa]">
      <header className="shrink-0 border-b border-slate-200/80 bg-white px-5 py-3.5 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <CreditCard className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">
                  Mon abonnement
                </h1>
                <p className="truncate text-[12px] text-slate-500">
                  {data.organizationName}
                </p>
              </div>
            </div>
          </div>
          {canRenew && data.canAccessZone && !awaitingReview ? (
            <Link
              href={needsPaymentAction ? "/abonnement" : renewHref}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-[13px] font-semibold text-white active:bg-slate-800 sm:h-9 sm:w-auto sm:text-[12px] sm:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {needsPaymentAction ? "Continuer le paiement" : renewLabel}
            </Link>
          ) : null}
        </div>
      </header>

      {expiryAlert ? (
        <SubscriptionExpiryBanner
          alert={expiryAlert}
          canRenew={canRenew && data.canAccessZone}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 items-stretch overflow-hidden p-4 sm:p-5">
        <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {data.error ? (
            <div className="shrink-0 border-b border-red-100 bg-red-50 px-5 py-2.5 text-[12px] text-red-800">
              {data.error}
            </div>
          ) : null}

          {/* Indicateurs */}
          <section className="shrink-0 border-b border-slate-100">
            <div className="flex gap-0 overflow-x-auto divide-x divide-slate-100 sm:grid sm:grid-cols-3 sm:overflow-visible">
              <div className="min-w-[9.5rem] shrink-0 px-4 py-4 sm:min-w-0 sm:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Accès
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusStyle}`}
                  >
                    {PLATFORM_ACCESS_STATUS_LABELS[data.access.status] ??
                      data.access.status}
                  </span>
                </div>
                {daysLeft != null ? (
                  <p
                    className={`mt-2 text-[13px] font-semibold tabular-nums ${
                      daysLeft <= 0
                        ? "text-red-700"
                        : daysLeft <= 7
                          ? "text-amber-700"
                          : "text-slate-900"
                    }`}
                  >
                    {daysLeft > 0
                      ? `${daysLeft} j restants`
                      : "Échéance dépassée"}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] font-medium text-slate-500">—</p>
                )}
              </div>

              <div className="min-w-[9.5rem] shrink-0 px-4 py-4 sm:min-w-0 sm:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {endLabel}
                </p>
                <p className="mt-2 text-[13px] font-semibold tabular-nums text-slate-900">
                  {endValue}
                </p>
                {data.currentSubscription ? (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {
                      PLATFORM_SUBSCRIPTION_STATUS_LABELS[
                        data.currentSubscription.status
                      ]
                    }
                    {data.currentSubscription.planName
                      ? ` · ${data.currentSubscription.planName}`
                      : ""}
                  </p>
                ) : data.trialStatus ? (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {data.trialStatus}
                  </p>
                ) : null}
              </div>

              <div className="min-w-[9.5rem] shrink-0 px-4 py-4 sm:min-w-0 sm:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Demande
                </p>
                {openRequest ? (
                  <>
                    <p className="mt-2 text-[13px] font-semibold text-slate-900">
                      {PLATFORM_REQUEST_STATUS_LABELS[openRequest.status]}
                    </p>
                    <p className="mt-1.5 truncate text-[11px] tabular-nums text-slate-500">
                      {openRequest.referenceCode}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[13px] font-semibold text-slate-900">
                      Aucune
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Pas de dossier ouvert
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Message principal */}
          <section className="shrink-0 border-b border-slate-100 px-5 py-4">
            {awaitingReview ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <p className="text-[13px] font-semibold text-slate-900">
                  Preuve d’abonnement reçue
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                  L’équipe FasoBar examine votre demande. Aucune action n’est
                  requise de votre côté pour le moment.
                </p>
              </div>
            ) : needsPaymentAction ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <p className="text-[13px] font-semibold text-slate-900">
                  Paiement à finaliser
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                  Déposez le montant sur Orange Money puis envoyez la capture du
                  reçu pour validation.
                </p>
              </div>
            ) : expiryAlert ? (
              <p className="text-[12px] leading-relaxed text-slate-600">
                Agissez avant la date de fin pour conserver l’accès de toute
                l’équipe (caisse, bar, cuisine).
              </p>
            ) : data.access.status === "TRIAL" ? (
              <p className="text-[12px] leading-relaxed text-slate-600">
                Vous êtes en période d’essai. Souscrivez une formule avant la
                date de fin pour éviter toute interruption.
              </p>
            ) : data.access.status === "ACTIVE" ? (
              <p className="text-[12px] leading-relaxed text-slate-600">
                Renouvelez avant la date de fin : la nouvelle période s’ajoute
                sans coupure d’activité.
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-slate-600">
                Aucun abonnement actif. Souscrivez une formule pour retrouver
                l’accès complet.
              </p>
            )}
          </section>

          {/* Détail demande */}
          <section className="min-h-0 flex-1 overflow-hidden px-5 py-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Détail
            </h2>

            {openRequest ? (
              <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Référence
                  </dt>
                  <dd className="mt-1.5 truncate text-[13px] font-semibold tabular-nums text-slate-900">
                    {openRequest.referenceCode}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Formule
                  </dt>
                  <dd className="mt-1.5 truncate text-[13px] font-semibold text-slate-900">
                    {openRequest.planName}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Montant
                  </dt>
                  <dd className="mt-1.5 text-[13px] font-semibold tabular-nums text-slate-900">
                    {formatXof(openRequest.expectedAmountXof)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-[12px] text-slate-500">
                Aucune demande d’abonnement en cours.
              </p>
            )}

            {!canRenew ? (
              <p className="mt-3 text-[11px] text-slate-500">
                Seul le propriétaire (OWNER) peut gérer le paiement.
              </p>
            ) : null}

            {canRenew && needsPaymentAction ? (
              <Link
                href="/abonnement"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-3.5 text-[13px] font-semibold text-white active:bg-slate-800 sm:h-9 sm:w-auto sm:text-[12px] sm:hover:bg-slate-800"
              >
                Continuer le paiement
              </Link>
            ) : null}
          </section>

          {/* Orange Money — uniquement si paiement encore requis */}
          {showDeposit ? (
            <section className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Dépôt Orange Money
                  </p>
                  <p className="mt-1.5 text-[20px] font-semibold tabular-nums tracking-wide text-slate-900">
                    {depositNumber}
                  </p>
                </div>
                <p className="max-w-[220px] text-right text-[11px] leading-snug text-slate-500">
                  Numéro officiel FasoBar. Aucun autre dépôt n’est valide.
                </p>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
