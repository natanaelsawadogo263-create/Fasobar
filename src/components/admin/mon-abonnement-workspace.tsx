"use client";

import Link from "next/link";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";

import type { AbonnementPageData } from "@/lib/abonnement/queries";
import {
  PLATFORM_REQUEST_STATUS_LABELS,
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
  daysUntil,
} from "@/lib/platform/access";
import {
  PLATFORM_ACCESS_STATUS_LABELS,
  PLATFORM_ACCESS_STATUS_STYLES,
} from "@/lib/platform/statuses";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function formatXof(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
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
  const isActiveOrTrial =
    data.access.status === "ACTIVE" || data.access.status === "TRIAL";
  const renewHref = "/abonnement?renouveler=1";
  const renewLabel =
    data.access.status === "TRIAL"
      ? "Passer à un abonnement"
      : data.access.status === "ACTIVE"
        ? "Renouveler avant expiration"
        : "Réactiver mon abonnement";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Abonnement
              </p>
            </div>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
              Mon abonnement
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-slate-500">
              {data.organizationName}
            </p>
          </div>
          {canRenew && data.canAccessZone ? (
            <Link
              href={renewHref}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {renewLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {data.error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-800">
            {data.error}
          </div>
        ) : null}

        <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Statut actuel
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset ${statusStyle}`}
              >
                {PLATFORM_ACCESS_STATUS_LABELS[data.access.status] ??
                  data.access.status}
              </span>
              {daysLeft != null ? (
                <span
                  className={`text-[12px] font-medium ${
                    daysLeft <= 0
                      ? "text-red-700"
                      : daysLeft <= 7
                        ? "text-amber-700"
                        : "text-slate-600"
                  }`}
                >
                  {daysLeft > 0
                    ? `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`
                    : "Échéance dépassée"}
                </span>
              ) : null}
            </div>

            <dl className="mt-4 space-y-3 text-[13px]">
              {data.trialEndsAt ? (
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500">Fin d’essai</dt>
                  <dd className="font-medium text-slate-900">
                    {formatDate(data.trialEndsAt)}
                    {data.trialStatus ? (
                      <span className="ml-1 text-slate-500">
                        · {data.trialStatus}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}

              {data.currentSubscription ? (
                <>
                  <div className="flex justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500">Formule</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {data.currentSubscription.planName ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500">État abonnement</dt>
                    <dd className="font-medium text-slate-900">
                      {
                        PLATFORM_SUBSCRIPTION_STATUS_LABELS[
                          data.currentSubscription.status
                        ]
                      }
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500">Début</dt>
                    <dd className="font-medium text-slate-900">
                      {formatDate(data.currentSubscription.startsAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500">Fin</dt>
                    <dd className="font-medium text-slate-900">
                      {formatDate(data.currentSubscription.endsAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Montant</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {formatXof(data.currentSubscription.amountPaidXof)}
                    </dd>
                  </div>
                </>
              ) : (
                <p className="text-slate-600">
                  {data.access.status === "TRIAL"
                    ? "Vous êtes en période d’essai. Souscrivez une formule pour éviter toute interruption après la fin de l’essai."
                    : "Aucun abonnement actif pour le moment."}
                </p>
              )}
            </dl>

            {isActiveOrTrial && canRenew ? (
              <div className="mt-4 flex gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <p className="text-[12px] leading-relaxed text-emerald-900">
                  Renouvelez <span className="font-semibold">avant</span> la date
                  de fin : la nouvelle période commence à la suite de
                  l’actuelle, sans coupure d’activité.
                </p>
              </div>
            ) : null}

            {canRenew && data.canAccessZone ? (
              <Link
                href={renewHref}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 text-[13px] font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {renewLabel}
              </Link>
            ) : !canRenew ? (
              <p className="mt-4 text-[12px] text-slate-500">
                Seul le propriétaire (OWNER) peut renouveler l’abonnement.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Demandes & paiements
            </h2>
            {data.openRequest ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950">
                Demande ouverte{" "}
                <span className="font-semibold">
                  {data.openRequest.referenceCode}
                </span>
                {" — "}
                {PLATFORM_REQUEST_STATUS_LABELS[data.openRequest.status]}
                <p className="mt-1 text-[12px] text-amber-800">
                  {data.openRequest.planName} ·{" "}
                  {formatXof(data.openRequest.expectedAmountXof)}
                </p>
                {canRenew ? (
                  <Link
                    href="/abonnement"
                    className="mt-2 inline-flex text-[12px] font-semibold text-amber-900 underline"
                  >
                    Continuer le paiement / preuve
                  </Link>
                ) : null}
              </div>
            ) : null}

            {data.requests.length === 0 ? (
              <p className="mt-3 text-[13px] text-slate-500">
                Aucune demande d’abonnement.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.requests.slice(0, 8).map((req) => (
                  <li
                    key={req.id}
                    className="flex flex-wrap items-center gap-2 py-2.5"
                  >
                    <span className="text-[13px] font-medium text-slate-900">
                      {req.referenceCode}
                    </span>
                    <span className="text-[12px] text-slate-500">
                      {req.planName}
                    </span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      {PLATFORM_REQUEST_STATUS_LABELS[req.status]}
                    </span>
                    <span className="ml-auto text-[11px] tabular-nums text-slate-400">
                      {formatDate(req.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {canRenew ? (
              <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
                Orange Money :{" "}
                <span className="font-semibold text-slate-700">
                  {data.orangeMoneyNumber}
                </span>
                . Après validation du paiement par FasoBar, la période
                s’ajoute automatiquement à la suite de votre abonnement en
                cours.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
