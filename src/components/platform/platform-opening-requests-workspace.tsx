"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Mail, MapPin, Phone, UserRound } from "lucide-react";

import {
  PlatformAlert,
  PlatformBody,
  PlatformButton,
  PlatformEmptyState,
  PlatformPage,
  formatPlatformDateTime,
} from "@/components/platform/platform-ui";
import { useToast } from "@/components/ui/toast";
import {
  approveEstablishmentOpeningAction,
  rejectEstablishmentOpeningAction,
} from "@/lib/platform/actions";
import type { EstablishmentOpeningRequest } from "@/lib/platform/opening-requests-queries";

type Props = {
  requests: EstablishmentOpeningRequest[];
  error?: string | null;
};

export function PlatformOpeningRequestsWorkspace({
  requests,
  error = null,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function run(
    organizationId: string,
    action: "approve" | "reject",
  ) {
    setPendingId(organizationId);
    startTransition(async () => {
      const result =
        action === "approve"
          ? await approveEstablishmentOpeningAction({ organizationId })
          : await rejectEstablishmentOpeningAction({ organizationId });
      if (result.ok) {
        toast.success(
          action === "approve"
            ? "Demande confirmée. La personne peut maintenant ouvrir son espace."
            : "Demande refusée.",
        );
      } else {
        toast.error(result.error ?? "Action impossible.");
      }
      setPendingId(null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <PlatformPage>
      <PlatformBody>
        {error ? <PlatformAlert tone="error">{error}</PlatformAlert> : null}

        {requests.length === 0 ? (
          <PlatformEmptyState title="Aucune demande en attente" />
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const busy = pending && pendingId === request.organizationId;
              return (
                <article
                  key={request.organizationId}
                  className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                    Souhaite ouvrir un établissement
                  </p>
                  <h2 className="mt-1 text-[17px] font-semibold text-slate-900">
                    {request.establishmentName || request.organizationName}
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-500">
                    Demande reçue le {formatPlatformDateTime(request.requestedAt)}
                  </p>

                  <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Info
                      icon={<UserRound className="h-4 w-4" />}
                      label="Personne"
                      value={request.ownerName || "Nom non renseigné"}
                    />
                    <Info
                      icon={<Mail className="h-4 w-4" />}
                      label="E-mail"
                      value={request.ownerEmail || "—"}
                    />
                    <Info
                      icon={<Phone className="h-4 w-4" />}
                      label="Téléphone"
                      value={request.ownerPhone || "—"}
                    />
                    <Info
                      icon={<Building2 className="h-4 w-4" />}
                      label="Activité"
                      value={request.activityLabel || "—"}
                    />
                    <Info
                      icon={<MapPin className="h-4 w-4" />}
                      label="Ville"
                      value={request.establishmentCity || "—"}
                    />
                    <Info
                      icon={<Building2 className="h-4 w-4" />}
                      label="Organisation"
                      value={request.organizationName}
                    />
                  </dl>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <PlatformButton
                      tone="success"
                      disabled={pending}
                      onClick={() => run(request.organizationId, "approve")}
                    >
                      {busy ? "Validation…" : "Confirmer l’ouverture"}
                    </PlatformButton>
                    <PlatformButton
                      tone="secondary"
                      disabled={pending}
                      onClick={() => run(request.organizationId, "reject")}
                    >
                      Refuser
                    </PlatformButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PlatformBody>
    </PlatformPage>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <span className="mt-0.5 text-emerald-700">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </dt>
        <dd className="truncate text-[13px] font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
