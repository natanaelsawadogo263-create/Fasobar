"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import {
  PlatformAlert,
  PlatformBody,
  PlatformButton,
  PlatformPage,
  formatPlatformDateTime,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import {
  approveSubscriptionPaymentAction,
  getProofSignedUrlAction,
  rejectSubscriptionPaymentAction,
  requestNewPaymentProofAction,
  reviewSubscriptionRequestAction,
} from "@/lib/platform/actions";
import {
  PLATFORM_REQUEST_STATUS_LABELS,
  PLATFORM_REQUEST_STATUSES,
  canApproveRequest,
  type PlatformRequestStatus,
} from "@/lib/platform/access";
import type { PlatformSubscriptionRequestRow } from "@/lib/platform/requests-queries";

function RequestStatusBadge({ status }: { status: PlatformRequestStatus }) {
  const styles: Record<PlatformRequestStatus, string> = {
    PENDING_PAYMENT: "bg-amber-50 text-amber-800 ring-amber-200",
    PAYMENT_SUBMITTED: "bg-sky-50 text-sky-800 ring-sky-200",
    UNDER_REVIEW: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    NEEDS_NEW_PROOF: "bg-orange-50 text-orange-800 ring-orange-200",
    APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    REJECTED: "bg-red-50 text-red-800 ring-red-200",
    CANCELLED: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {PLATFORM_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[12.5px] text-slate-900">{value}</p>
    </div>
  );
}

type Props = {
  requests: PlatformSubscriptionRequestRow[];
  error?: string | null;
};

export function PlatformRequestsWorkspace({ requests, error = null }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PlatformRequestStatus>(
    "ALL",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    requests[0]?.id ?? null,
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      PLATFORM_REQUEST_STATUSES.map((s) => [s, 0]),
    ) as Record<PlatformRequestStatus, number>;
    for (const row of requests) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!q) return true;
      return [
        row.referenceCode,
        row.organizationName,
        row.ownerName,
        row.planName,
        row.transactionReference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [requests, query, statusFilter]);

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  function runAction(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.error ?? "Action impossible.");
        return;
      }
      setMessage(success);
      setNote("");
    });
  }

  return (
    <PlatformPage>
      <PlatformBody className="!py-3 lg:!px-4 lg:!py-3">
        <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
          {error ? (
            <PlatformAlert tone="error">
              Impossible de charger les demandes : {error}
            </PlatformAlert>
          ) : null}
          {message ? (
            <PlatformAlert
              tone={/impossible|erreur|échou/i.test(message) ? "error" : "success"}
            >
              {message}
            </PlatformAlert>
          ) : null}

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:flex-row">
            {/* Liste */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-100 lg:border-b-0 lg:border-r">
              <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mr-auto text-[13px] font-semibold text-slate-900">
                    Demandes
                    <span className="ml-1.5 font-medium text-slate-400">
                      {filtered.length}
                      {filtered.length !== requests.length
                        ? `/${requests.length}`
                        : ""}
                    </span>
                  </h2>
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
                </div>

                <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      statusFilter === "ALL"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Tous · {requests.length}
                  </button>
                  {PLATFORM_REQUEST_STATUSES.map((status) => {
                    const count = statusCounts[status] ?? 0;
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
                        {PLATFORM_REQUEST_STATUS_LABELS[status]} · {count}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="platform-requests-snap app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                {filtered.length === 0 ? (
                  <p className="px-4 py-10 text-center text-[12px] text-slate-500">
                    Aucune demande pour ces critères.
                  </p>
                ) : (
                  filtered.map((row) => {
                    const active = selected?.id === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`snap-start flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-0 sm:px-4 ${
                          active
                            ? "bg-emerald-50/70"
                            : "hover:bg-slate-50/90"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[12.5px] font-semibold text-slate-900">
                              {row.referenceCode}
                            </span>
                            <RequestStatusBadge status={row.status} />
                          </div>
                          <p className="mt-0.5 truncate text-[12px] text-slate-700">
                            {row.ownerName ?? "OWNER"} · {row.organizationName}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {row.planName} · {formatPlatformXof(row.expectedAmountXof)}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-[11px] text-slate-400">
                          {formatPlatformDateTime(row.createdAt)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Détail */}
            <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:w-[360px] xl:w-[400px]">
              {!selected ? (
                <div className="flex flex-1 items-center justify-center px-4 text-center text-[12px] text-slate-500">
                  Sélectionnez une demande.
                </div>
              ) : (
                <>
                  <div className="shrink-0 border-b border-slate-100 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {selected.referenceCode}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-slate-500">
                          {selected.organizationName}
                        </p>
                      </div>
                      <RequestStatusBadge status={selected.status} />
                    </div>
                  </div>

                  <div className="app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Client" value={selected.ownerName ?? "OWNER"} />
                      <Field label="Formule" value={selected.planName} />
                      <Field
                        label="Montant attendu"
                        value={formatPlatformXof(selected.expectedAmountXof)}
                      />
                      <Field
                        label="Déclaré"
                        value={
                          selected.declaredAmountXof != null
                            ? formatPlatformXof(selected.declaredAmountXof)
                            : "—"
                        }
                      />
                      <Field
                        label="Transaction"
                        value={selected.transactionReference ?? "—"}
                      />
                      <Field
                        label="Payeur"
                        value={
                          [selected.payerName, selected.payerPhone]
                            .filter(Boolean)
                            .join(" · ") || "—"
                        }
                      />
                      <Field
                        label="Soumise"
                        value={formatPlatformDateTime(selected.submittedAt)}
                      />
                      <Field
                        label="Créée"
                        value={formatPlatformDateTime(selected.createdAt)}
                      />
                    </div>

                    {selected.reviewNote || selected.rejectionReason ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                        {selected.rejectionReason ?? selected.reviewNote}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/platform/clients/${selected.organizationId}`}
                        className="inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Voir le client
                      </Link>
                      {selected.proofStoragePath ? (
                        <PlatformButton
                          tone="ghost"
                          disabled={pending}
                          className="!px-2.5 !py-1.5 !text-[11px] !border-sky-200 !bg-sky-50 !text-sky-800"
                          onClick={() =>
                            runAction(async () => {
                              const r = await getProofSignedUrlAction({
                                storagePath: selected.proofStoragePath!,
                              });
                              if (r.ok) {
                                window.open(r.url, "_blank", "noopener,noreferrer");
                                return { ok: true };
                              }
                              return r;
                            }, "Preuve ouverte.")
                          }
                        >
                          Voir la preuve
                        </PlatformButton>
                      ) : null}
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <label className="block text-[11px] font-medium text-slate-600">
                        Note / motif
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Commentaire ou motif de refus"
                        />
                      </label>

                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <PlatformButton
                          tone="ghost"
                          disabled={pending}
                          className="!py-1.5 !text-[11px] !border-indigo-200 !bg-indigo-50 !text-indigo-800"
                          onClick={() =>
                            runAction(
                              () =>
                                reviewSubscriptionRequestAction({
                                  requestId: selected.id,
                                  note,
                                }),
                              "Mise en examen.",
                            )
                          }
                        >
                          En examen
                        </PlatformButton>
                        <PlatformButton
                          tone="ghost"
                          disabled={pending}
                          className="!py-1.5 !text-[11px] !border-orange-200 !bg-orange-50 !text-orange-800"
                          onClick={() =>
                            runAction(
                              () =>
                                requestNewPaymentProofAction({
                                  requestId: selected.id,
                                  note,
                                }),
                              "Nouvelle preuve demandée.",
                            )
                          }
                        >
                          Nouvelle preuve
                        </PlatformButton>
                        <PlatformButton
                          tone="success"
                          disabled={pending || !canApproveRequest(selected.status)}
                          className="!py-1.5 !text-[11px]"
                          onClick={() =>
                            runAction(
                              () =>
                                approveSubscriptionPaymentAction({
                                  requestId: selected.id,
                                  note,
                                }),
                              "Paiement approuvé.",
                            )
                          }
                        >
                          Approuver
                        </PlatformButton>
                        <PlatformButton
                          tone="danger"
                          disabled={pending}
                          className="!py-1.5 !text-[11px]"
                          onClick={() =>
                            runAction(
                              () =>
                                rejectSubscriptionPaymentAction({
                                  requestId: selected.id,
                                  reason: note,
                                }),
                              "Demande refusée.",
                            )
                          }
                        >
                          Refuser
                        </PlatformButton>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </section>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
