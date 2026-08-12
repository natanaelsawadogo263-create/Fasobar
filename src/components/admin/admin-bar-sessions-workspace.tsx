"use client";

import { useState, useTransition } from "react";
import { GlassWater, Lock, X } from "lucide-react";

import { getAdminBarSessionDetailAction } from "@/app/(protected)/application/sessions-bar/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { BarSessionBilanView } from "@/components/bar/bar-session-bilan-view";
import { formatQuantity } from "@/lib/stock/constants";
import type {
  AdminBarSessionDetail,
  AdminBarSessionListItem,
} from "@/lib/admin/bar-sessions-queries";

type AdminBarSessionsWorkspaceProps = {
  sessions: AdminBarSessionListItem[];
  openCount: number;
  closedCount: number;
  establishmentName: string;
};

const STATUS_LABELS: Record<AdminBarSessionListItem["status"], string> = {
  OPEN: "Ouverte",
  CLOSED: "Fermée",
  CANCELLED: "Annulée",
};

const STATUS_STYLES: Record<AdminBarSessionListItem["status"], string> = {
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

export function AdminBarSessionsWorkspace({
  sessions,
  openCount,
  closedCount,
  establishmentName,
}: AdminBarSessionsWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<AdminBarSessionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function openDetail(sessionId: string) {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    startTransition(async () => {
      const result = await getAdminBarSessionDetailAction(sessionId);
      if (result.error || !result.data) {
        setDetailError(result.error ?? "Impossible de charger cette session.");
        return;
      }
      setDetail(result.data);
    });
  }

  const stats = [
    {
      title: "Ouvertes",
      shortTitle: "Ouvertes",
      value: String(openCount),
      valueClass: "text-emerald-700",
    },
    {
      title: "Fermées",
      shortTitle: "Fermées",
      value: String(closedCount),
      valueClass: "text-slate-900",
    },
    {
      title: "Total",
      shortTitle: "Total",
      value: String(sessions.length),
      valueClass: "text-slate-900",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 py-2.5 sm:gap-3 sm:p-3 lg:gap-3.5 lg:p-4">
      <header className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px] lg:text-[22px]">
            Sessions Bar
          </h1>
          <p className="mt-0.5 hidden text-[12px] text-slate-500 sm:block">
            {establishmentName} · bilans de clôture en lecture seule
          </p>
        </div>
      </header>

      {/* KPI mobile : défilement horizontal */}
      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 md:hidden">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="w-[38%] min-w-[7.5rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm"
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {stat.shortTitle}
            </p>
            <p className={`mt-1 text-[18px] font-bold tabular-nums ${stat.valueClass}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* KPI desktop */}
      <div className="hidden shrink-0 grid-cols-3 gap-2.5 md:grid">
        {stats.map((stat) => (
          <article
            key={stat.title}
            className="rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200/80"
          >
            <p className="text-[11px] text-slate-500">{stat.title}</p>
            <p className={`text-[22px] font-bold ${stat.valueClass}`}>{stat.value}</p>
          </article>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 py-16 text-center">
            <GlassWater className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-[13px] font-medium text-slate-700">Aucune session bar</p>
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
                        {session.managerName}
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
                      Servies{" "}
                      <strong className="tabular-nums text-slate-900">
                        {session.ordersServedCount}
                      </strong>
                    </span>
                    <span>
                      Boissons{" "}
                      <strong className="tabular-nums text-slate-900">
                        {formatQuantity(session.drinksOutQty)}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetail(session.id)}
                    className="mt-2.5 inline-flex h-10 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] font-semibold text-emerald-700 active:bg-emerald-100"
                  >
                    Voir le bilan
                  </button>
                </article>
              ))}
            </div>

            {/* Table desktop */}
            <table className="hidden w-full min-w-[720px] text-left text-[12px] md:table">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3.5 py-2.5 font-medium">Responsable</th>
                  <th className="px-3.5 py-2.5 font-medium">Ouverture</th>
                  <th className="px-3.5 py-2.5 font-medium">Fermeture</th>
                  <th className="px-3.5 py-2.5 font-medium">Statut</th>
                  <th className="px-3.5 py-2.5 font-medium text-right">Servies</th>
                  <th className="px-3.5 py-2.5 font-medium text-right">Boissons</th>
                  <th className="px-3.5 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/80">
                    <td className="px-3.5 py-2.5 font-medium text-slate-900">
                      {session.managerName}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {formatDateTime(session.openedAt)}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {formatDateTime(session.closedAt)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[session.status]}`}
                      >
                        {STATUS_LABELS[session.status]}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">
                      {session.ordersServedCount}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">
                      {formatQuantity(session.drinksOutQty)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(session.id)}
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        Voir le bilan
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDetailOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <Lock className="h-3.5 w-3.5" />
                  Lecture seule
                </p>
                <h2 className="text-[16px] font-bold text-slate-900">
                  {detail?.managerName ?? "Session bar"}
                </h2>
                <p className="text-[12px] text-slate-500">
                  {detail
                    ? `${formatDateTime(detail.openedAt)} → ${formatDateTime(detail.closedAt)}`
                    : "Chargement…"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 active:bg-slate-100 active:text-slate-600 sm:h-9 sm:w-9 sm:hover:bg-slate-100 sm:hover:text-slate-600"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {isPending && !detail ? (
                <p className="py-10 text-center text-[13px] text-slate-500">
                  Chargement du bilan…
                </p>
              ) : null}
              {detailError ? <AlertMessage message={detailError} /> : null}
              {detail ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[12px] sm:grid-cols-3">
                    <div>
                      <dt className="text-slate-500">Responsable</dt>
                      <dd className="font-medium text-slate-900">{detail.managerName}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Fermé par</dt>
                      <dd className="font-medium text-slate-900">
                        {detail.closedByName ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Statut</dt>
                      <dd className="font-medium text-slate-900">
                        {STATUS_LABELS[detail.status]}
                      </dd>
                    </div>
                  </dl>
                  {detail.openingNote ? (
                    <p className="text-[12px] text-slate-600">
                      <span className="font-semibold">Ouverture :</span> {detail.openingNote}
                    </p>
                  ) : null}
                  {detail.closingNote ? (
                    <p className="text-[12px] text-slate-600">
                      <span className="font-semibold">Clôture :</span> {detail.closingNote}
                    </p>
                  ) : null}
                  {detail.summary ? (
                    <BarSessionBilanView summary={detail.summary} />
                  ) : (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
                      Bilan détaillé indisponible pour cette session (migration non appliquée
                      ou session encore ouverte sans snapshot).
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
