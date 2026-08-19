"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Clock, Fuel, Lock, Unlock } from "lucide-react";

import { InstantLink } from "@/components/layout/instant-link";
import type { AdminPumpSessionListItem } from "@/lib/admin/station-sessions-queries";
import { formatPriceXof } from "@/lib/products/constants";
import { formatQuantity } from "@/lib/stock/constants";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";

type Period = "day" | "week" | "month";

type StationPumpSessionsWorkspaceProps = {
  sessions: AdminPumpSessionListItem[];
  openCount: number;
  closedCount: number;
  establishmentName: string;
  periodFilter: Period;
  periodFrom?: string;
  periodTo?: string;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StationPumpSessionsWorkspace({
  sessions,
  openCount,
  closedCount,
  establishmentName,
  periodFilter,
  periodFrom,
  periodTo,
}: StationPumpSessionsWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const periodChips = useMemo(
    () =>
      (["day", "week", "month"] as const).map((period) => {
        const range = resolveOrderPeriodRange(period, toLocalIsoDate(new Date()));
        const href = `/application/station/sessions?period=${period}&from=${range.from}&to=${range.to}`;
        return { period, href, label: period === "day" ? "Jour" : period === "week" ? "Semaine" : "Mois" };
      }),
    [],
  );

  const applyPeriod = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
      <header className="shrink-0">
        <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Sessions pompistes</h1>
        <p className="mt-1 text-[12px] text-slate-600">
          {establishmentName} · {openCount} ouverte{openCount > 1 ? "s" : ""} · {closedCount} clôturée
          {closedCount > 1 ? "s" : ""}
        </p>
      </header>

      <div className="no-print flex shrink-0 gap-2 overflow-x-auto pb-1">
        {periodChips.map((chip) => {
          const active = periodFilter === chip.period;
          return (
            <button
              key={chip.period}
              type="button"
              onClick={() => applyPeriod(chip.href)}
              disabled={isPending}
              className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold transition ${
                active
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 active:bg-slate-50"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {periodFrom && periodTo ? (
        <p className="text-[11px] text-slate-500">
          Période : {periodFrom} → {periodTo}
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <div>
            <Fuel className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-[13px] font-medium text-slate-800">Aucune session sur cette période</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
          {sessions.map((session) => {
            const open = session.status === "OPEN";
            return (
              <article
                key={session.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-slate-900">
                      {session.fuelPumpName} · {session.fuelTypeName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-600">
                      {session.openedByName ?? "Pompiste"} · {formatWhen(session.openedAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      open
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {open ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {open ? "Ouverte" : "Clôturée"}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-4">
                  <div>
                    <dt className="font-medium text-slate-500">Index début</dt>
                    <dd className="font-semibold text-slate-900">
                      {session.indexStart.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Index fin</dt>
                    <dd className="font-semibold text-slate-900">
                      {session.indexEnd == null
                        ? "—"
                        : session.indexEnd.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Litres</dt>
                    <dd className="font-semibold text-slate-900">
                      {session.litersSold == null ? "—" : formatQuantity(session.litersSold)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Encaissé</dt>
                    <dd className="font-semibold text-slate-900">
                      {session.totalCollected == null
                        ? "—"
                        : formatPriceXof(session.totalCollected)}
                    </dd>
                  </div>
                </dl>

                {!open ? (
                  <div className="mt-3 flex gap-2">
                    <InstantLink
                      href={`/application/station/sessions/${session.id}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white active:bg-emerald-700"
                    >
                      <Clock className="h-4 w-4" />
                      Voir la fiche
                    </InstantLink>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
