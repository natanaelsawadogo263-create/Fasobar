"use client";

import type { ReactNode } from "react";

import { InstantLink as Link } from "@/components/layout/instant-link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  Globe,
  Mail,
  Phone,
  Smartphone,
  User,
} from "lucide-react";

import { PLATFORM_SUBSCRIPTION_STATUS_LABELS } from "@/lib/platform/access";
import { printSubscriptionReceipt } from "@/lib/platform/print-subscription-receipt";
import type { PlatformSubscriptionReceipt } from "@/lib/platform/subscriptions-queries";

type Props = {
  receipt: PlatformSubscriptionReceipt;
};

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} F CFA`;
}

const BILLING_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "Mensuel",
  YEARLY: "Annuel",
};

function InfoLine({
  icon: Icon,
  children,
}: {
  icon: typeof Mail;
  children: ReactNode;
}) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-600">
      <Icon className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2.2} />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}

export function PlatformSubscriptionReceiptView({ receipt }: Props) {
  const issuedOn = formatLongDate(receipt.createdAt);
  const periodLabel =
    BILLING_PERIOD_LABELS[receipt.billingPeriod] ?? receipt.billingPeriod;

  return (
    <div className="subscription-receipt-host flex min-h-0 w-full flex-1 flex-col bg-slate-100">
      <div className="no-print shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link
            href={`/platform/clients/${receipt.organizationId}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la fiche client
          </Link>
          <button
            type="button"
            onClick={() => printSubscriptionReceipt()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            <Download className="h-4 w-4" />
            Télécharger le PDF
          </button>
        </div>
      </div>

      <div className="subscription-receipt-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 py-6 sm:px-6">
        <article className="subscription-receipt relative w-full max-w-[210mm] shrink-0 overflow-hidden bg-white text-slate-900 shadow-lg ring-1 ring-slate-200">
          {/* Bandeau de couleur — effet papier à en-tête */}
          <div className="h-2.5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500" />

          {/* Filigrane discret */}
          <p
            aria-hidden
            className="receipt-watermark pointer-events-none absolute left-1/2 top-[52%] z-0 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] select-none whitespace-nowrap text-[110px] font-black tracking-tight text-slate-900/[0.035]"
          >
            FASOBAR
          </p>

          <div className="relative z-10 p-10 sm:p-12">
            {/* En-tête */}
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-center gap-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo imprimé, taille contrôlée par CSS */}
                <img
                  src="/brand/fasobar-logo.png"
                  alt="FasoBar"
                  className="receipt-logo h-12 w-12 shrink-0 object-contain"
                />
                <div>
                  <p className="text-[20px] font-bold leading-tight tracking-tight text-slate-900">
                    Faso<span className="text-emerald-700">Bar</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Logiciel de gestion pour commerces et établissements
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="receipt-badge inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Paiement confirmé
                </span>
                <h1 className="mt-2.5 text-[17px] font-bold uppercase tracking-[0.06em] text-slate-900">
                  Reçu de paiement
                </h1>
                <p className="mt-1 text-[12px] text-slate-500">
                  N°{" "}
                  <span className="font-mono font-semibold text-slate-800">
                    {receipt.referenceCode}
                  </span>
                </p>
                <p className="text-[12px] text-slate-500">Émis le {issuedOn}</p>
              </div>
            </header>

            <div className="my-8 h-px bg-gradient-to-r from-slate-200 via-slate-200 to-transparent" />

            {/* Facturé à / Émis par */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  <Building2 className="h-3 w-3" strokeWidth={2.4} />
                  Facturé à
                </h2>
                <p className="mt-2 text-[14px] font-semibold text-slate-900">
                  {receipt.organizationName}
                </p>
                {receipt.ownerName ? (
                  <InfoLine icon={User}>{receipt.ownerName}</InfoLine>
                ) : null}
                {receipt.ownerEmail ? (
                  <InfoLine icon={Mail}>{receipt.ownerEmail}</InfoLine>
                ) : null}
                {receipt.ownerPhone ? (
                  <InfoLine icon={Phone}>{receipt.ownerPhone}</InfoLine>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  <Building2 className="h-3 w-3" strokeWidth={2.4} />
                  Émis par
                </h2>
                <p className="mt-2 text-[14px] font-semibold text-slate-900">FasoBar</p>
                <InfoLine icon={Globe}>fasobar.com</InfoLine>
                <InfoLine icon={Mail}>sn7editor@gmail.com</InfoLine>
                <InfoLine icon={Phone}>+226 57 53 72 99</InfoLine>
              </div>
            </section>

            {/* Détail de l'abonnement */}
            <section className="mt-8">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Détail de l&rsquo;abonnement
              </h2>
              <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-900 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-white">
                      <th className="py-2.5 pl-4 pr-3 font-semibold">Description</th>
                      <th className="py-2.5 pr-3 font-semibold">Période</th>
                      <th className="py-2.5 pr-3 text-right font-semibold">Statut</th>
                      <th className="py-2.5 pl-3 pr-4 text-right font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="py-3.5 pl-4 pr-3 align-top">
                        <p className="font-medium text-slate-900">
                          Abonnement FasoBar — Formule{" "}
                          {receipt.planName ?? receipt.planCode ?? "—"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {periodLabel} · {receipt.durationMonths} mois
                        </p>
                      </td>
                      <td className="py-3.5 pr-3 align-top text-slate-700">
                        Du {formatLongDate(receipt.startsAt)}
                        <br />
                        au {formatLongDate(receipt.endsAt)}
                      </td>
                      <td className="py-3.5 pr-3 align-top text-right text-slate-700">
                        {PLATFORM_SUBSCRIPTION_STATUS_LABELS[receipt.status]}
                      </td>
                      <td className="py-3.5 pl-3 pr-4 align-top text-right font-semibold tabular-nums text-slate-900">
                        {formatXof(receipt.amountPaidXof)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="w-full max-w-[240px] rounded-xl bg-emerald-50 px-5 py-3.5 ring-1 ring-inset ring-emerald-100">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                    Total payé
                  </p>
                  <p className="mt-0.5 text-right text-[24px] font-bold tabular-nums text-emerald-800">
                    {formatXof(receipt.amountPaidXof)}
                  </p>
                </div>
              </div>
            </section>

            {/* Moyen de paiement */}
            {receipt.transactionReference ||
            receipt.orangeMoneyNumber ||
            receipt.payerName ? (
              <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  <Smartphone className="h-3 w-3" strokeWidth={2.4} />
                  Moyen de paiement
                </h2>
                <dl className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Méthode</dt>
                    <dd className="font-medium text-slate-800">Orange Money</dd>
                  </div>
                  {receipt.orangeMoneyNumber ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Numéro FasoBar</dt>
                      <dd className="font-medium tabular-nums text-slate-800">
                        {receipt.orangeMoneyNumber}
                      </dd>
                    </div>
                  ) : null}
                  {receipt.payerName ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Payeur</dt>
                      <dd className="font-medium text-slate-800">{receipt.payerName}</dd>
                    </div>
                  ) : null}
                  {receipt.payerPhone ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Téléphone payeur</dt>
                      <dd className="font-medium tabular-nums text-slate-800">
                        {receipt.payerPhone}
                      </dd>
                    </div>
                  ) : null}
                  {receipt.transactionReference ? (
                    <div className="flex justify-between gap-3 sm:col-span-2">
                      <dt className="text-slate-500">Référence transaction</dt>
                      <dd className="font-mono font-medium tabular-nums text-slate-800">
                        {receipt.transactionReference}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {/* Pied de page */}
            <footer className="mt-10 border-t border-slate-200 pt-5 text-center">
              <p className="text-[13px] font-semibold text-slate-800">
                Merci pour votre confiance.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3 w-3" /> fasobar.com
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> sn7editor@gmail.com
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> +226 57 53 72 99
                </span>
              </div>
              <p className="mx-auto mt-3 max-w-md text-[10.5px] leading-relaxed text-slate-400">
                Nous sommes heureux de vous accompagner au quotidien dans la gestion de
                votre établissement.
              </p>
            </footer>
          </div>
        </article>
        <div className="no-print h-10 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
