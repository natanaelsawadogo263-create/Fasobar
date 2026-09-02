"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Receipt as ReceiptIcon, Search } from "lucide-react";

import {
  PlatformAlert,
  PlatformBody,
  PlatformButton,
  PlatformPage,
  formatPlatformDate,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import { useToast } from "@/components/ui/toast";
import { cancelOrganizationSubscriptionAction } from "@/lib/platform/actions";
import {
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
  PLATFORM_SUBSCRIPTION_STATUSES,
  type PlatformSubscriptionStatus,
} from "@/lib/platform/access";
import type {
  PlatformPlanRow,
  PlatformSubscriptionRow,
} from "@/lib/platform/subscriptions-queries";

function SubBadge({ status }: { status: PlatformSubscriptionStatus }) {
  const styles: Record<PlatformSubscriptionStatus, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    EXPIRED: "bg-slate-100 text-slate-700 ring-slate-200",
    SUSPENDED: "bg-red-50 text-red-800 ring-red-200",
    CANCELLED: "bg-orange-50 text-orange-800 ring-orange-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {PLATFORM_SUBSCRIPTION_STATUS_LABELS[status]}
    </span>
  );
}

const ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_auto_minmax(0,0.7fr)_auto] items-center gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_auto_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto]";

type Props = {
  subscriptions: PlatformSubscriptionRow[];
  plans: PlatformPlanRow[];
  error?: string | null;
};

export function PlatformSubscriptionsWorkspace({
  subscriptions,
  plans,
  error = null,
}: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | PlatformSubscriptionStatus
  >("ALL");
  const [currentOnly, setCurrentOnly] = useState(true);
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const statusCounts = useMemo(() => {
    const source = currentOnly
      ? subscriptions.filter((s) => s.isCurrent)
      : subscriptions;
    const counts = Object.fromEntries(
      PLATFORM_SUBSCRIPTION_STATUSES.map((s) => [s, 0]),
    ) as Record<PlatformSubscriptionStatus, number>;
    for (const row of source) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return { counts, total: source.length };
  }, [subscriptions, currentOnly]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscriptions.filter((row) => {
      if (currentOnly && !row.isCurrent) return false;
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!q) return true;
      return [row.organizationName, row.planName, row.planCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [subscriptions, query, statusFilter, currentOnly]);

  return (
    <PlatformPage>
      <PlatformBody className="!py-3 lg:!px-4 lg:!py-3">
        <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
          {error ? (
            <PlatformAlert tone="error">
              Impossible de charger les abonnements : {error}
            </PlatformAlert>
          ) : null}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-[12px] font-medium text-slate-500">
                  {filtered.length} abonnement{filtered.length > 1 ? "s" : ""}
                  {plans.length > 0 ? ` · ${plans.length} formules` : ""}
                </p>

                <label className="relative block w-full max-w-[200px] flex-1 sm:w-auto">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2.5 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={currentOnly}
                    onChange={(e) => setCurrentOnly(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Courants
                </label>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    statusFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Tous · {statusCounts.total}
                </button>
                {PLATFORM_SUBSCRIPTION_STATUSES.map((status) => {
                  const count = statusCounts.counts[status] ?? 0;
                  if (count === 0 && statusFilter !== status) return null;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setStatusFilter((prev) =>
                          prev === status ? "ALL" : status,
                        )
                      }
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        statusFilter === status
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {PLATFORM_SUBSCRIPTION_STATUS_LABELS[status]} · {count}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={`${ROW_GRID} shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:px-4`}
            >
              <span>Organisation</span>
              <span>Formule</span>
              <span>Statut</span>
              <span className="hidden md:block">Début</span>
              <span className="hidden md:block">Fin</span>
              <span>Payé</span>
              <span className="w-16" />
            </div>

            <div className="platform-subscriptions-snap app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-slate-500">
                  Aucun abonnement pour ces critères.
                </p>
              ) : (
                filtered.map((row) => (
                  <div
                    key={row.id}
                    className={`${ROW_GRID} snap-start border-b border-slate-100 px-3 py-2.5 text-[12.5px] last:border-0 hover:bg-slate-50/90 sm:px-4`}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/platform/clients/${row.organizationId}`}
                        className="block truncate font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:text-emerald-700 hover:decoration-emerald-400 active:text-emerald-700"
                      >
                        {row.organizationName}
                      </Link>
                      {row.isCurrent ? (
                        <span className="mt-0.5 inline-block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          Courant
                        </span>
                      ) : (
                        <span className="mt-0.5 inline-block text-[10px] font-medium text-slate-400">
                          Historique
                        </span>
                      )}
                    </div>

                    <span className="truncate text-slate-700">
                      {row.planName ?? row.planCode ?? "—"}
                    </span>

                    <SubBadge status={row.status} />

                    <span className="hidden truncate tabular-nums text-slate-500 md:block">
                      {formatPlatformDate(row.startsAt)}
                    </span>
                    <span className="hidden truncate tabular-nums text-slate-500 md:block">
                      {formatPlatformDate(row.endsAt)}
                    </span>

                    <span className="truncate tabular-nums text-slate-700">
                      {formatPlatformXof(row.amountPaidXof)}
                    </span>

                    <div className="flex items-center justify-end gap-2 md:gap-1">
                      <a
                        href={`/platform/abonnements/${row.id}/recu`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-50 active:text-emerald-700 md:h-7 md:w-7"
                        aria-label="Reçu de paiement"
                        title="Reçu de paiement"
                      >
                        <ReceiptIcon className="h-3.5 w-3.5" />
                      </a>
                      {row.isCurrent && row.status === "ACTIVE" ? (
                        <PlatformButton
                          tone="danger"
                          disabled={pending}
                          className="h-9 !px-2.5 !py-1.5 !text-[11px] md:h-7 md:!px-2 md:!py-1 md:!text-[10px]"
                          onClick={() => {
                            const reason = window.prompt(
                              "Motif d’annulation (optionnel) :",
                            );
                            if (reason === null) return;
                            startTransition(async () => {
                              const result =
                                await cancelOrganizationSubscriptionAction({
                                  organizationId: row.organizationId,
                                  reason: reason || undefined,
                                });
                              if (result.ok) {
                                toast.success("Abonnement annulé.");
                              } else {
                                toast.error(result.error ?? "Action impossible.");
                              }
                            });
                          }}
                        >
                          Annuler
                        </PlatformButton>
                      ) : (
                        <Link
                          href={`/platform/clients/${row.organizationId}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-50 active:text-emerald-700 md:h-7 md:w-7"
                          aria-label="Voir le client"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
