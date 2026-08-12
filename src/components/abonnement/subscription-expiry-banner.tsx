"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import {
  getSubscriptionExpiryAlertCopy,
  type SubscriptionExpiryAlert,
} from "@/lib/platform/access";

type Props = {
  alert: SubscriptionExpiryAlert;
  canRenew?: boolean;
  compact?: boolean;
};

export function SubscriptionExpiryBanner({
  alert,
  canRenew = false,
  compact = false,
}: Props) {
  const copy = getSubscriptionExpiryAlertCopy(alert);
  const critical = alert.urgency === "critical";

  return (
    <div
      role="alert"
      className={`shrink-0 border-b px-4 py-2.5 sm:px-5 ${
        critical
          ? "border-red-200 bg-red-50 text-red-950"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-6xl gap-3 ${
          compact ? "items-center" : "items-start"
        }`}
      >
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            critical ? "text-red-700" : "text-amber-700"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug">{copy.title}</p>
          {!compact ? (
            <p className="mt-0.5 text-[12px] leading-relaxed opacity-90">
              {copy.body}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-snug opacity-90 sm:hidden">
              Renouvelez avant le{" "}
              {new Intl.DateTimeFormat("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(new Date(alert.endsAt))}
              .
            </p>
          )}
          {compact ? (
            <p className="mt-0.5 hidden text-[12px] leading-snug opacity-90 sm:block">
              {copy.body}
            </p>
          ) : null}
        </div>
        {canRenew ? (
          <Link
            href="/abonnement?renouveler=1"
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white ${
              critical
                ? "bg-red-700 hover:bg-red-800"
                : "bg-amber-800 hover:bg-amber-900"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Renouveler
          </Link>
        ) : (
          <p className="hidden max-w-[11rem] shrink-0 text-right text-[11px] leading-snug opacity-80 sm:block">
            Contactez le propriétaire pour renouveler.
          </p>
        )}
      </div>
    </div>
  );
}
