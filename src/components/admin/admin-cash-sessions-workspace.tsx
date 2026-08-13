"use client";

import { useState, useTransition } from "react";
import { Landmark, X } from "lucide-react";

import { getAdminCashSessionDetailAction } from "@/app/(protected)/application/caisses/actions";
import { getActivityPages } from "@/lib/activity/pages";
import { AlertMessage } from "@/components/auth/alert-message";
import { formatOrderNumber, formatPriceXof } from "@/lib/orders/constants";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/constants";
import type {
  AdminCashSessionDetail,
  AdminCashSessionListItem,
} from "@/lib/admin/cash-sessions-queries";

type AdminCashSessionsWorkspaceProps = {
  sessions: AdminCashSessionListItem[];
  openCount: number;
  closedCount: number;
  totalCashCollected: number;
  establishmentName: string;
  activityCode?: string | null;
};

const STATUS_LABELS: Record<AdminCashSessionListItem["status"], string> = {
  OPEN: "Ouverte",
  CLOSED: "Fermée",
  CANCELLED: "Annulée",
};

const STATUS_STYLES: Record<AdminCashSessionListItem["status"], string> = {
  OPEN: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-red-50 text-red-700",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function differenceClass(difference: number | null): string {
  if (difference === null) return "text-slate-500";
  if (difference === 0) return "text-emerald-700";
  return difference > 0 ? "text-sky-700" : "text-red-700";
}

export function AdminCashSessionsWorkspace({
  sessions,
  openCount,
  closedCount,
  totalCashCollected,
  establishmentName,
  activityCode = null,
}: AdminCashSessionsWorkspaceProps) {
  const pages = getActivityPages(activityCode);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<AdminCashSessionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function openDetail(sessionId: string) {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    startTransition(async () => {
      const result = await getAdminCashSessionDetailAction(sessionId);
      if (result.error || !result.data) {
        setDetailError(result.error ?? "Impossible de charger cette session.");
        return;
      }
      setDetail(result.data);
    });
  }

  const stats = [
    {
      title: "Sessions ouvertes",
      shortTitle: "Ouvertes",
      value: String(openCount),
      subtitle: "en cours",
    },
    {
      title: "Sessions fermées",
      shortTitle: "Fermées",
      value: String(closedCount),
      subtitle: "clôturées",
    },
    {
      title: "Espèces encaissées",
      shortTitle: "Espèces",
      value: formatPriceXof(totalCashCollected),
      subtitle: "toutes sessions affichées",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 py-2.5 sm:gap-3 sm:p-3 lg:gap-3.5 lg:p-4">
      <header className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px] lg:text-[22px]">
            Caisses
          </h1>
          <p className="mt-0.5 hidden text-[12px] text-slate-500 sm:block">
            {establishmentName} · {pages.cash.subtitle}
          </p>
        </div>
      </header>

      {/* KPI mobile : défilement horizontal */}
      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 md:hidden">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="w-[42%] min-w-[9.5rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm"
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {stat.shortTitle}
            </p>
            <p className="mt-1 truncate text-[15px] font-bold tabular-nums text-slate-900">
              {stat.value}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      {/* KPI desktop */}
      <div className="hidden shrink-0 grid-cols-3 gap-2.5 md:grid lg:gap-3">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {stat.title}
            </p>
            <p className="mt-1 text-[18px] font-bold text-slate-900">{stat.value}</p>
            <p className="text-[11px] text-slate-500">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        {sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Landmark className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-slate-900">
              Aucune session de caisse
            </h2>
            <p className="mt-1 max-w-sm text-[12px] text-slate-500">
              Les sessions ouvertes et fermées par les {pages.retail ? "vendeurs" : "caissiers"} apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            {/* Liste cartes mobile */}
            <div className="space-y-1.5 p-2 md:hidden">
              {sessions.map((session) => (
                <article
                  key={session.id}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">
                        {session.cashierName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Ouverte {formatDateTime(session.openedAt)}
                        {session.closedAt
                          ? ` · Fermée ${formatDateTime(session.closedAt)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[session.status]}`}
                    >
                      {STATUS_LABELS[session.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                    <span>
                      Espèces{" "}
                      <strong className="tabular-nums text-slate-900">
                        {formatPriceXof(session.cashCollected)}
                      </strong>
                    </span>
                    <span>
                      Attendu{" "}
                      <strong className="tabular-nums text-slate-900">
                        {formatPriceXof(session.expectedCashAmount)}
                      </strong>
                    </span>
                    <span className={differenceClass(session.cashDifference)}>
                      Écart{" "}
                      <strong className="tabular-nums">
                        {session.cashDifference !== null
                          ? formatPriceXof(session.cashDifference)
                          : "—"}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetail(session.id)}
                    className="mt-2.5 inline-flex h-10 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] font-semibold text-emerald-700 active:bg-emerald-100"
                  >
                    Voir détail
                  </button>
                </article>
              ))}
            </div>

            {/* Table desktop */}
            <table className="hidden min-w-full text-left text-[12px] md:table">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Caissier·ère</th>
                  <th className="px-3 py-2.5 font-semibold">Ouverte le</th>
                  <th className="px-3 py-2.5 font-semibold">Fermée le</th>
                  <th className="px-3 py-2.5 font-semibold">Fond initial</th>
                  <th className="px-3 py-2.5 font-semibold">Espèces encaissées</th>
                  <th className="px-3 py-2.5 font-semibold">Attendu</th>
                  <th className="px-3 py-2.5 font-semibold">Compté</th>
                  <th className="px-3 py-2.5 font-semibold">Écart</th>
                  <th className="px-3 py-2.5 font-semibold">Statut</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {session.cashierName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {formatDateTime(session.openedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {formatDateTime(session.closedAt)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {formatPriceXof(session.openingCashAmount)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {formatPriceXof(session.cashCollected)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {formatPriceXof(session.expectedCashAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {session.countedCashAmount !== null
                        ? formatPriceXof(session.countedCashAmount)
                        : "—"}
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold ${differenceClass(session.cashDifference)}`}
                    >
                      {session.cashDifference !== null
                        ? formatPriceXof(session.cashDifference)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[session.status]}`}
                      >
                        {STATUS_LABELS[session.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                        onClick={() => openDetail(session.id)}
                      >
                        Voir détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDetailOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold text-slate-900">Détail de la session</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Lecture seule — paiements et reçus liés à cette caisse.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100 sm:h-9 sm:w-9 sm:hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              {isPending ? (
                <p className="text-[12px] text-slate-500">Chargement…</p>
              ) : detailError ? (
                <AlertMessage message={detailError} />
              ) : detail ? (
                <>
                  <section className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-[12px] sm:grid-cols-3">
                    <div>
                      <p className="text-slate-500">Caissier·ère</p>
                      <p className="font-semibold text-slate-900">{detail.cashierName}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Ouverte le</p>
                      <p className="font-semibold text-slate-900">
                        {formatDateTime(detail.openedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fermée le</p>
                      <p className="font-semibold text-slate-900">
                        {formatDateTime(detail.closedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fond initial</p>
                      <p className="font-semibold text-slate-900">
                        {formatPriceXof(detail.openingCashAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Attendu / Compté</p>
                      <p className="font-semibold text-slate-900">
                        {formatPriceXof(detail.expectedCashAmount)} /{" "}
                        {detail.countedCashAmount !== null
                          ? formatPriceXof(detail.countedCashAmount)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Écart</p>
                      <p className={`font-semibold ${differenceClass(detail.cashDifference)}`}>
                        {detail.cashDifference !== null
                          ? formatPriceXof(detail.cashDifference)
                          : "—"}
                      </p>
                    </div>
                    {detail.openingNote ? (
                      <div className="col-span-full">
                        <p className="text-slate-500">Note d&apos;ouverture</p>
                        <p className="text-slate-800">{detail.openingNote}</p>
                      </div>
                    ) : null}
                    {detail.closingNote ? (
                      <div className="col-span-full">
                        <p className="text-slate-500">Note de fermeture</p>
                        <p className="text-slate-800">{detail.closingNote}</p>
                      </div>
                    ) : null}
                  </section>

                  <section>
                    <h3 className="text-[13px] font-semibold text-slate-900">
                      Paiements ({detail.payments.length})
                    </h3>
                    {/* Paiements mobile */}
                    <div className="mt-2 space-y-1.5 md:hidden">
                      {detail.payments.length === 0 ? (
                        <p className="rounded-xl border border-slate-200 px-3 py-4 text-center text-[12px] text-slate-400">
                          Aucun paiement enregistré sur cette session.
                        </p>
                      ) : (
                        detail.payments.map((payment) => (
                          <article
                            key={payment.id}
                            className="rounded-xl border border-slate-200 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-slate-900">
                                  {payment.orderNumber !== null
                                    ? formatOrderNumber(payment.orderNumber)
                                    : "—"}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                                  {payment.status === "CONFIRMED"
                                    ? "Confirmé"
                                    : payment.status}
                                </p>
                              </div>
                              <p className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
                                {formatPriceXof(payment.amountApplied)}
                              </p>
                            </div>
                            {payment.receiptId ? (
                              <a
                                href={`/application/recus/${payment.receiptId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] font-semibold text-emerald-700 active:bg-emerald-100"
                              >
                                Voir le reçu
                              </a>
                            ) : null}
                          </article>
                        ))
                      )}
                    </div>
                    {/* Paiements desktop */}
                    <div className="mt-2 hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                      <table className="min-w-full text-left text-[12px]">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{pages.cash.orderColumn}</th>
                            <th className="px-3 py-2 font-semibold">Méthode</th>
                            <th className="px-3 py-2 font-semibold">Montant</th>
                            <th className="px-3 py-2 font-semibold">Statut</th>
                            <th className="px-3 py-2 font-semibold">Reçu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detail.payments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                                Aucun paiement enregistré sur cette session.
                              </td>
                            </tr>
                          ) : (
                            detail.payments.map((payment) => (
                              <tr key={payment.id}>
                                <td className="px-3 py-2 font-medium text-slate-900">
                                  {payment.orderNumber !== null
                                    ? formatOrderNumber(payment.orderNumber)
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {PAYMENT_METHOD_LABELS[payment.method]}
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-900">
                                  {formatPriceXof(payment.amountApplied)}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {payment.status === "CONFIRMED"
                                    ? "Confirmé"
                                    : payment.status}
                                </td>
                                <td className="px-3 py-2">
                                  {payment.receiptId ? (
                                    <a
                                      href={`/application/recus/${payment.receiptId}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-semibold text-emerald-700 hover:underline"
                                    >
                                      Voir
                                    </a>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
