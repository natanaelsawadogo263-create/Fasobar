"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Clock3,
  Fuel,
  LayoutDashboard,
  Lock,
  Settings,
  TrendingDown,
  TrendingUp,
  Unlock,
  Users,
} from "lucide-react";

import { InstantLink } from "@/components/layout/instant-link";
import type { AdminPumpSessionListItem } from "@/lib/admin/station-sessions-queries";
import type {
  StationDashboardData,
  StationDashboardPeriod,
} from "@/lib/admin/station-dashboard-queries";
import { formatPriceXof } from "@/lib/products/constants";
import { formatQuantity } from "@/lib/stock/constants";

type StationAdminDashboardWorkspaceProps = {
  data: StationDashboardData;
};

const PERIOD_OPTIONS: Array<{ id: StationDashboardPeriod; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

function trendLabel(current: number, previous: number): {
  text: string;
  up: boolean;
  flat: boolean;
} {
  if (previous <= 0) {
    return {
      text: current > 0 ? "Nouveau sur la période" : "Aucune activité",
      up: current > 0,
      flat: current === 0,
    };
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) {
    return { text: "Stable vs période préc.", up: true, flat: true };
  }
  return {
    text: `${change >= 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")} % vs période préc.`,
    up: change >= 0,
    flat: false,
  };
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrendBadge({
  trend,
}: {
  trend: { text: string; up: boolean; flat: boolean };
}) {
  if (trend.flat) {
    return <span className="text-[11px] font-medium text-slate-500">{trend.text}</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        trend.up ? "text-emerald-700" : "text-red-700"
      }`}
    >
      {trend.up ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {trend.text}
    </span>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <InstantLink
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm active:bg-slate-50"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      {label}
    </InstantLink>
  );
}

function SessionRow({ session }: { session: AdminPumpSessionListItem }) {
  const open = session.status === "OPEN";
  return (
    <div className="flex items-start justify-between gap-2 border-b border-slate-100 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-slate-900">
          {session.fuelPumpName} · {session.fuelTypeName}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {session.openedByName ?? "Pompiste"} · {formatWhen(session.openedAt)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {open ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
            <Unlock className="h-3 w-3" />
            Ouverte
          </span>
        ) : (
          <>
            <p className="text-[12px] font-bold text-slate-900">
              {session.totalCollected == null
                ? "—"
                : formatPriceXof(session.totalCollected)}
            </p>
            <p className="text-[10px] text-slate-500">
              {session.litersSold == null ? "—" : `${formatQuantity(session.litersSold)} L`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function StationAdminDashboardWorkspace({ data }: StationAdminDashboardWorkspaceProps) {
  const router = useRouter();
  const { kpis, openSessions, recentClosed, period, periodLabel, establishmentName } =
    data;

  const revenueTrend = trendLabel(kpis.revenue, kpis.revenuePrevious);
  const litersTrend = trendLabel(kpis.liters, kpis.litersPrevious);

  function setPeriod(next: StationDashboardPeriod) {
    const params = new URLSearchParams();
    if (next !== "day") params.set("period", next);
    const query = params.toString();
    router.push(query ? `/application/station?${query}` : "/application/station");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
      <header className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
              Tableau de bord
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-600">
              {establishmentName} · Station-service · {periodLabel}
            </p>
          </div>
          <div className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriod(option.id)}
                className={`h-9 rounded-lg px-3 text-[12px] font-semibold transition ${
                  period === option.id
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 active:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-0.5">
        <QuickLink
          href="/application/station/employes"
          icon={<Users className="h-4 w-4" />}
          label="Employés"
        />
        <QuickLink
          href="/application/station/sessions"
          icon={<Clock3 className="h-4 w-4" />}
          label="Sessions"
        />
        <QuickLink
          href="/application/station/bilans"
          icon={<BarChart3 className="h-4 w-4" />}
          label="Bilans"
        />
        <QuickLink
          href="/application/station/parametres"
          icon={<Settings className="h-4 w-4" />}
          label="Paramètres"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Encaissements
          </p>
          <p className="mt-1 text-[20px] font-bold text-slate-900">
            {formatPriceXof(kpis.revenue)}
          </p>
          <div className="mt-1">
            <TrendBadge trend={revenueTrend} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Litres vendus
          </p>
          <p className="mt-1 text-[20px] font-bold text-slate-900">
            {formatQuantity(kpis.liters)}
          </p>
          <div className="mt-1">
            <TrendBadge trend={litersTrend} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Sessions clôturées
          </p>
          <p className="mt-1 text-[20px] font-bold text-slate-900">{kpis.closedCount}</p>
          <p className="mt-1 text-[11px] text-slate-500">Sur la période</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            En cours
          </p>
          <p className="mt-1 text-[20px] font-bold text-emerald-700">{kpis.openCount}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {kpis.openCount === 1 ? "Relève ouverte" : "Relèves ouvertes"}
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-slate-900">Sessions ouvertes</h2>
            <InstantLink
              href="/application/station/sessions"
              className="text-[11px] font-semibold text-emerald-700"
            >
              Tout voir
            </InstantLink>
          </div>
          {openSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Lock className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-[12px] text-slate-500">Aucune relève en cours</p>
            </div>
          ) : (
            openSessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-slate-900">Dernières clôtures</h2>
            <InstantLink
              href="/application/station/bilans"
              className="text-[11px] font-semibold text-emerald-700"
            >
              Bilans
            </InstantLink>
          </div>
          {recentClosed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Fuel className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-[12px] text-slate-500">Aucune session clôturée</p>
            </div>
          ) : (
            recentClosed.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))
          )}
        </section>
      </div>

      <div className="hidden shrink-0 items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 lg:flex">
        <LayoutDashboard className="h-4 w-4 text-emerald-600" />
        Vue d&apos;ensemble station — encaissements et relèves pompistes en temps réel.
      </div>
    </div>
  );
}
