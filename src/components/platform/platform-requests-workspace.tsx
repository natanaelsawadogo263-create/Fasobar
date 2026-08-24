"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileImage,
  ListFilter,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  PlatformAlert,
  PlatformBody,
  PlatformButton,
  PlatformPage,
  formatPlatformDateTime,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import { useToast } from "@/components/ui/toast";
import {
  approveSubscriptionPaymentAction,
  deleteSubscriptionRequestAction,
  getProofSignedUrlAction,
  rejectSubscriptionPaymentAction,
  requestNewPaymentProofAction,
  reviewSubscriptionRequestAction,
} from "@/lib/platform/actions";
import {
  PLATFORM_REQUEST_STATUS_LABELS,
  canApproveRequest,
  canDeleteRequest,
  type PlatformRequestStatus,
} from "@/lib/platform/access";
import { toWhatsAppDigits } from "@/lib/platform/phone-utils";
import type { PlatformSubscriptionRequestRow } from "@/lib/platform/requests-queries";

type QueueFilter =
  | "ACTION"
  | "ALL"
  | "PENDING_PAYMENT"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

const ACTIONABLE: PlatformRequestStatus[] = [
  "PAYMENT_SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_NEW_PROOF",
];

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
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {PLATFORM_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

const KPI_TONES = {
  warning: {
    icon: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
  },
  info: {
    icon: "bg-sky-100 text-sky-700",
    bar: "bg-sky-500",
  },
  success: {
    icon: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
  },
  danger: {
    icon: "bg-rose-100 text-rose-700",
    bar: "bg-rose-500",
  },
} as const;

function RequestKpiButton({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof KPI_TONES;
  active: boolean;
  onClick: () => void;
}) {
  const t = KPI_TONES[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80 ${
        active ? "bg-slate-50" : ""
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-[20px] font-bold tabular-nums tracking-tight text-slate-900">
          {value}
        </p>
      </div>
      <span
        className={`absolute inset-x-0 bottom-0 h-0.5 ${active ? t.bar : "bg-transparent"}`}
        aria-hidden
      />
    </button>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="shrink-0 text-[12px] text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-[12px] font-medium text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function ContactActions({
  phone,
  email,
  label,
}: {
  phone: string | null;
  email?: string | null;
  label: string;
}) {
  const wa = toWhatsAppDigits(phone);
  if (!phone && !email) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {phone ? (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          title={`Appeler ${label}`}
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
          title={`WhatsApp ${label}`}
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
      ) : null}
      {email ? (
        <a
          href={`mailto:${email}`}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Mail className="h-3 w-3" />
          Email
        </a>
      ) : null}
    </div>
  );
}

type Props = {
  requests: PlatformSubscriptionRequestRow[];
  error?: string | null;
};

export function PlatformRequestsWorkspace({ requests, error = null }: Props) {
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<QueueFilter>("ACTION");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [note, setNote] = useState("");
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const metrics = useMemo(() => {
    let action = 0;
    let pendingPayment = 0;
    let approved = 0;
    let rejected = 0;
    for (const row of requests) {
      if (ACTIONABLE.includes(row.status)) action += 1;
      if (row.status === "PENDING_PAYMENT") pendingPayment += 1;
      if (row.status === "APPROVED") approved += 1;
      if (row.status === "REJECTED") rejected += 1;
    }
    return { action, pendingPayment, approved, rejected, total: requests.length };
  }, [requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((row) => {
      if (queue === "ACTION" && !ACTIONABLE.includes(row.status)) return false;
      if (queue === "PENDING_PAYMENT" && row.status !== "PENDING_PAYMENT")
        return false;
      if (queue === "APPROVED" && row.status !== "APPROVED") return false;
      if (queue === "REJECTED" && row.status !== "REJECTED") return false;
      if (queue === "CANCELLED" && row.status !== "CANCELLED") return false;
      if (!q) return true;
      return [
        row.referenceCode,
        row.organizationName,
        row.ownerName,
        row.ownerPhone,
        row.planName,
        row.transactionReference,
        row.payerName,
        row.payerPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [requests, query, queue]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      setMobileDetailOpen(false);
      return;
    }
    if (!selectedId || !filtered.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0]!.id);
      setMobileDetailOpen(false);
    }
  }, [filtered, selectedId]);

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  function runAction(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Action impossible.");
        return;
      }
      toast.success(success);
      setNote("");
    });
  }

  return (
    <PlatformPage>
      <PlatformBody className="!py-3 lg:!px-4 lg:!py-3">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          {error ? (
            <PlatformAlert tone="error">
              Impossible de charger les demandes : {error}
            </PlatformAlert>
          ) : null}

          {/* KPIs — desktop uniquement (les puces de file suffisent sur mobile) */}
          <section className="hidden shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:block">
            <div className="grid grid-cols-4 divide-x divide-slate-100">
              <RequestKpiButton
                label="À traiter"
                value={metrics.action}
                icon={AlertCircle}
                tone="warning"
                active={queue === "ACTION"}
                onClick={() => setQueue("ACTION")}
              />
              <RequestKpiButton
                label="Attente paiement"
                value={metrics.pendingPayment}
                icon={Clock}
                tone="info"
                active={queue === "PENDING_PAYMENT"}
                onClick={() => setQueue("PENDING_PAYMENT")}
              />
              <RequestKpiButton
                label="Approuvées"
                value={metrics.approved}
                icon={CheckCircle2}
                tone="success"
                active={queue === "APPROVED"}
                onClick={() => setQueue("APPROVED")}
              />
              <RequestKpiButton
                label="Refusées"
                value={metrics.rejected}
                icon={XCircle}
                tone="danger"
                active={queue === "REJECTED"}
                onClick={() => setQueue("REJECTED")}
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:flex-row">
            {/* Liste — masquée sur mobile quand le détail est ouvert */}
            <div
              className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-100 lg:flex lg:border-b-0 lg:border-r ${
                mobileDetailOpen ? "hidden" : "flex"
              }`}
            >
              <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mr-auto text-[13px] font-semibold text-slate-900">
                    File de demandes
                    <span className="ml-1.5 font-medium text-slate-400">
                      {filtered.length}
                    </span>
                  </h2>
                  <label className="relative block w-full max-w-[220px] flex-1 sm:w-auto">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Réf., client, org…"
                      className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2.5 text-[12px] outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                </div>

                {/* Filtre de file — mobile uniquement (les cartes KPI ci-dessus font ce rôle sur desktop) */}
                <label className="relative mt-2 block lg:hidden">
                  <ListFilter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <select
                    value={queue}
                    onChange={(e) => setQueue(e.target.value as QueueFilter)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-8 text-[12.5px] font-medium text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="ACTION">À traiter · {metrics.action}</option>
                    <option value="PENDING_PAYMENT">
                      Attente paiement · {metrics.pendingPayment}
                    </option>
                    <option value="APPROVED">
                      Approuvées · {metrics.approved}
                    </option>
                    <option value="REJECTED">
                      Refusées · {metrics.rejected}
                    </option>
                    <option value="ALL">Toutes · {metrics.total}</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </label>
              </div>

              <div className="app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                {filtered.length === 0 ? (
                  <p className="px-4 py-12 text-center text-[12px] text-slate-500">
                    Aucune demande dans cette file.
                  </p>
                ) : (
                  filtered.map((row) => {
                    const active = selected?.id === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(row.id);
                          setMobileDetailOpen(true);
                        }}
                        className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition last:border-0 sm:px-4 ${
                          active
                            ? "border-l-2 border-l-slate-900 bg-slate-50"
                            : "border-l-2 border-l-transparent hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] font-semibold tabular-nums text-slate-900">
                              {row.referenceCode}
                            </span>
                            <RequestStatusBadge status={row.status} />
                          </div>
                          <p className="mt-1 truncate text-[12px] font-medium text-slate-800">
                            {row.organizationName}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {row.ownerName ?? "Propriétaire"} · {row.planName} ·{" "}
                            {formatPlatformXof(row.expectedAmountXof)}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-[10px] tabular-nums leading-tight text-slate-400">
                          {formatPlatformDateTime(row.submittedAt ?? row.createdAt)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Détail — plein écran sur mobile, panneau à droite sur desktop */}
            <aside
              className={`min-h-0 w-full flex-col overflow-hidden bg-[#fafbfc] lg:flex lg:w-[380px] lg:flex-none xl:w-[420px] ${
                mobileDetailOpen ? "flex min-h-0 flex-1" : "hidden"
              }`}
            >
              {!selected ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-slate-500">
                  Sélectionnez une demande pour l’examiner.
                </div>
              ) : (
                <>
                  <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setMobileDetailOpen(false)}
                      className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-slate-700 lg:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      File de demandes
                    </button>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[14px] font-semibold tabular-nums text-slate-900">
                          {selected.referenceCode}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-slate-500">
                          {selected.organizationName}
                        </p>
                      </div>
                      <RequestStatusBadge status={selected.status} />
                    </div>
                  </div>

                  <div className="app-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 pb-6">
                    {/* Client */}
                    <section className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Client
                      </h3>
                      <p className="mt-1.5 text-[13px] font-semibold text-slate-900">
                        {selected.ownerName ?? "Propriétaire non renseigné"}
                      </p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-slate-600">
                        {selected.ownerPhone ?? "Téléphone non renseigné"}
                      </p>
                      <ContactActions
                        phone={selected.ownerPhone}
                        label={selected.ownerName ?? "client"}
                      />
                      <Link
                        href={`/platform/clients/${selected.organizationId}`}
                        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Fiche client
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </section>

                    {/* Paiement */}
                    <section className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Paiement
                      </h3>
                      <dl className="mt-1 divide-y divide-slate-100">
                        <DetailRow label="Formule" value={selected.planName} />
                        <DetailRow
                          label="Montant attendu"
                          value={
                            <span className="tabular-nums">
                              {formatPlatformXof(selected.expectedAmountXof)}
                            </span>
                          }
                        />
                        <DetailRow
                          label="Montant déclaré"
                          value={
                            selected.declaredAmountXof != null ? (
                              <span className="tabular-nums">
                                {formatPlatformXof(selected.declaredAmountXof)}
                              </span>
                            ) : (
                              "—"
                            )
                          }
                        />
                        <DetailRow
                          label="Payeur"
                          value={
                            [selected.payerName, selected.payerPhone]
                              .filter(Boolean)
                              .join(" · ") || "—"
                          }
                        />
                        <DetailRow
                          label="Orange Money"
                          value={
                            <span className="tabular-nums">
                              {selected.orangeMoneyNumber || "—"}
                            </span>
                          }
                        />
                        <DetailRow
                          label="Soumise"
                          value={formatPlatformDateTime(selected.submittedAt)}
                        />
                      </dl>
                      {selected.payerPhone ? (
                        <ContactActions
                          phone={selected.payerPhone}
                          label={selected.payerName ?? "payeur"}
                        />
                      ) : null}
                    </section>

                    {/* Preuve */}
                    <section className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Preuve
                      </h3>
                      {selected.proofStoragePath ? (
                        <PlatformButton
                          tone="ghost"
                          disabled={pending}
                          className="mt-2 !h-9 !w-full !justify-center !gap-2 !border-slate-200 !bg-slate-50 !text-[12px] !text-slate-800"
                          onClick={() =>
                            runAction(async () => {
                              const r = await getProofSignedUrlAction({
                                storagePath: selected.proofStoragePath!,
                              });
                              if (r.ok) {
                                window.open(
                                  r.url,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                                return { ok: true };
                              }
                              return r;
                            }, "Preuve ouverte.")
                          }
                        >
                          <FileImage className="h-3.5 w-3.5" />
                          Ouvrir la capture du reçu
                        </PlatformButton>
                      ) : (
                        <p className="mt-2 text-[12px] text-slate-500">
                          Aucune preuve envoyée pour le moment.
                        </p>
                      )}
                      {selected.reviewNote || selected.rejectionReason ? (
                        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
                          {selected.rejectionReason ?? selected.reviewNote}
                        </p>
                      ) : null}
                    </section>

                    {/* Décision */}
                    <section className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Décision FasoBar
                      </h3>
                      <label className="mt-2 block text-[11px] font-medium text-slate-600">
                        Note / motif
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                          placeholder="Commentaire interne ou motif de refus"
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <PlatformButton
                          tone="ghost"
                          disabled={pending}
                          className="!py-2 !text-[11px]"
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
                          className="!py-2 !text-[11px]"
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
                          disabled={
                            pending || !canApproveRequest(selected.status)
                          }
                          className="!py-2 !text-[11px]"
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
                          className="!py-2 !text-[11px]"
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

                      {canDeleteRequest(selected.status) ? (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <PlatformButton
                            tone="danger"
                            disabled={pending}
                            className="!w-full !justify-center !gap-1.5 !py-2 !text-[11px]"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Supprimer définitivement la demande ${selected.referenceCode} ? Cette action est irréversible.`,
                                )
                              ) {
                                return;
                              }
                              runAction(
                                () =>
                                  deleteSubscriptionRequestAction({
                                    requestId: selected.id,
                                  }),
                                "Demande supprimée.",
                              );
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer la demande
                          </PlatformButton>
                        </div>
                      ) : null}
                    </section>
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
