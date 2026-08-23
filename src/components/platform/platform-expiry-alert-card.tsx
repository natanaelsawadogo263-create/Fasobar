"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";

import type { PlatformExpiryAlert } from "@/lib/platform/expiry-alerts-types";
import { toWhatsAppDigits } from "@/lib/platform/phone-utils";
import { formatPlatformDate } from "@/components/platform/platform-ui";

function contactPhone(alert: PlatformExpiryAlert): string | null {
  return alert.ownerPhone || alert.billingPhone || null;
}

function daysLabel(days: number): string {
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "demain";
  return `dans ${days} j`;
}

type Props = {
  alert: PlatformExpiryAlert;
  compact?: boolean;
};

export function PlatformExpiryAlertCard({ alert, compact = false }: Props) {
  const phone = contactPhone(alert);
  const wa = toWhatsAppDigits(phone);
  const critical = alert.urgency === "critical";
  const kindLabel = alert.kind === "trial" ? "Essai" : "Abonnement";

  return (
    <article
      className={`rounded-xl border px-3.5 py-3 ${
        critical
          ? "border-red-200 bg-red-50/70"
          : "border-amber-200 bg-amber-50/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">
            {alert.organizationName}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-600">
            {alert.ownerName ?? "Propriétaire non renseigné"}
            {alert.planName ? ` · ${alert.planName}` : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              critical
                ? "bg-red-100 text-red-800 ring-red-200"
                : "bg-amber-100 text-amber-900 ring-amber-200"
            }`}
          >
            {kindLabel} · {daysLabel(alert.daysRemaining)}
          </span>
          <span className="text-[11px] tabular-nums text-slate-500">
            Fin {formatPlatformDate(alert.endsAt)}
          </span>
        </div>
      </div>

      {!compact ? (
        <dl className="mt-2.5 grid gap-1 border-t border-black/5 pt-2.5 text-[11px] sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="text-slate-500">Tél.</dt>
            <dd className="font-medium tabular-nums text-slate-800">
              {phone ?? "—"}
            </dd>
          </div>
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-slate-500">Email</dt>
            <dd className="truncate font-medium text-slate-800">
              {alert.ownerEmail ?? "—"}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Phone className="h-3 w-3" />
            Appeler
          </a>
        ) : null}
        {wa ? (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </a>
        ) : null}
        {alert.ownerEmail ? (
          <a
            href={`mailto:${alert.ownerEmail}?subject=${encodeURIComponent(
              `FasoBar — renouvellement ${alert.organizationName}`,
            )}`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Mail className="h-3 w-3" />
            Email
          </a>
        ) : null}
        <Link
          href={`/platform/clients/${alert.organizationId}`}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-900 px-2 text-[11px] font-semibold text-white hover:bg-slate-800"
        >
          Fiche client
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}
