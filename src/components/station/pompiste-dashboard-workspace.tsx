"use client";

import {
  ArrowRight,
  Clock3,
  Droplets,
  Fuel,
  Gauge,
  Timer,
  Unlock,
  Users,
} from "lucide-react";

import { InstantLink, startNavProgress } from "@/components/layout/instant-link";
import type { PompisteDashboardData } from "@/lib/station/pompiste-dashboard-queries";
import { formatPriceXof } from "@/lib/products/constants";
import { formatQuantity } from "@/lib/stock/constants";

type PompisteDashboardWorkspaceProps = {
  data: PompisteDashboardData;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("fr-FR") + word.slice(1).toLocaleLowerCase("fr-FR"))
    .join(" ");
}

function PumpStatusChip({
  status,
}: {
  status: PompisteDashboardData["pumps"][number]["status"];
}) {
  if (status === "mine") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Ma relève
      </span>
    );
  }
  if (status === "occupied") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Occupée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Libre
    </span>
  );
}

export function PompisteDashboardWorkspace({ data }: PompisteDashboardWorkspaceProps) {
  const {
    establishmentName,
    operatorName,
    ownSession,
    pumps,
    liveStats,
    teamOnShift,
    availablePumpCount,
  } = data;

  const sessionHref = "/application/station/pompiste/session";
  const hasOpenSession = Boolean(ownSession);
  const occupiedCount = pumps.filter((p) => p.status === "occupied").length;
  const firstName = operatorName.split(" ")[0] ?? operatorName;
  const canOpenShift = pumps.length > 0 && availablePumpCount > 0 && !hasOpenSession;

  const summaryKpis = hasOpenSession && liveStats
    ? [
        {
          label: "Index départ",
          value: formatQuantity(liveStats.indexStart),
          icon: Gauge,
          tone: "text-slate-900",
          iconWrap: "bg-slate-100 text-slate-600",
          ring: "hover:ring-slate-200",
        },
        {
          label: "Index actuel",
          value: formatQuantity(liveStats.indexCurrent),
          icon: Gauge,
          tone: "text-slate-900",
          iconWrap: "bg-slate-100 text-slate-600",
          ring: "hover:ring-slate-200",
        },
        {
          label: "Litres vendus",
          value: `${formatQuantity(liveStats.litersSold)} L`,
          icon: Droplets,
          tone: "text-emerald-700",
          iconWrap: "bg-emerald-50 text-emerald-600",
          ring: "hover:ring-emerald-100",
        },
        {
          label: "CA estimé",
          value: formatPriceXof(liveStats.estimatedRevenue),
          icon: Timer,
          tone: "text-emerald-700",
          iconWrap: "bg-emerald-50 text-emerald-600",
          ring: "hover:ring-emerald-100",
        },
      ]
    : [
        {
          label: "Pompes actives",
          value: String(pumps.length),
          icon: Fuel,
          tone: "text-slate-900",
          iconWrap: "bg-slate-100 text-slate-600",
          ring: "hover:ring-slate-200",
        },
        {
          label: "Disponibles",
          value: String(availablePumpCount),
          icon: Unlock,
          tone: "text-emerald-700",
          iconWrap: "bg-emerald-50 text-emerald-600",
          ring: "hover:ring-emerald-100",
        },
        {
          label: "En relève",
          value: String(occupiedCount + (hasOpenSession ? 1 : 0)),
          icon: Clock3,
          tone: "text-amber-700",
          iconWrap: "bg-amber-50 text-amber-600",
          ring: "hover:ring-amber-100",
        },
        {
          label: "Équipe",
          value: String(teamOnShift.length + (hasOpenSession ? 1 : 0)),
          icon: Users,
          tone: "text-sky-700",
          iconWrap: "bg-sky-50 text-sky-600",
          ring: "hover:ring-sky-100",
        },
      ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-4 py-4 lg:gap-5 lg:px-6 lg:py-5">
      <header className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Ma pompe</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Bonjour {firstName} — vue d&apos;ensemble de votre relève à{" "}
              {titleCase(establishmentName)}
            </p>
          </div>

          {hasOpenSession && ownSession ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 ring-1 ring-emerald-200/80">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate text-[12px] font-semibold text-emerald-800">
                  Relève ouverte
                </span>
                <span className="hidden text-[12px] text-emerald-700/70 sm:inline">
                  · {ownSession.fuelPumpName}
                  {liveStats ? ` · ${formatDuration(liveStats.durationMinutes)}` : ""}
                </span>
              </div>
              <InstantLink
                href={sessionHref}
                onClick={() => startNavProgress()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-[12px] font-semibold text-white transition hover:bg-slate-800"
              >
                Fiche / Clôturer
                <ArrowRight className="h-3.5 w-3.5" />
              </InstantLink>
            </div>
          ) : pumps.length === 0 ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-[12px] font-semibold text-amber-900">Parc non configuré</span>
            </div>
          ) : availablePumpCount === 0 ? (
            <div className="inline-flex max-w-md items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200/80">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span className="truncate text-[12px] text-amber-900">
                <span className="font-semibold">Toutes les pompes occupées</span>
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="text-[12px] font-semibold text-slate-600">Hors relève</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {hasOpenSession ? (
            <InstantLink
              href={sessionHref}
              onClick={() => startNavProgress()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              <Timer className="h-3.5 w-3.5" />
              Continuer ma fiche
            </InstantLink>
          ) : (
            <InstantLink
              href={sessionHref}
              onClick={() => startNavProgress()}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold shadow-sm transition ${
                canOpenShift
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "cursor-not-allowed bg-slate-200 text-slate-500"
              }`}
              aria-disabled={!canOpenShift}
            >
              <Unlock className="h-3.5 w-3.5" />
              Ouvrir ma relève
            </InstantLink>
          )}
          <InstantLink
            href={sessionHref}
            onClick={() => startNavProgress()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Fuel className="h-3.5 w-3.5" />
            Ma session
          </InstantLink>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {summaryKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200/80 transition hover:ring-2 ${kpi.ring}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kpi.iconWrap}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </p>
                  <p
                    className={`mt-0.5 truncate text-[22px] font-bold leading-none tabular-nums lg:text-[26px] ${kpi.tone}`}
                  >
                    {kpi.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2 lg:gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-100 px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-slate-900">Parc pompes</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
                {pumps.length}
              </span>
            </div>
            {hasOpenSession ? (
              <InstantLink
                href={sessionHref}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                Ma fiche
                <ArrowRight className="h-3 w-3" />
              </InstantLink>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {pumps.length === 0 ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Fuel className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-slate-900">Parc non configuré</p>
                <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-slate-500">
                  Votre responsable station doit créer les pompes dans{" "}
                  <span className="font-medium text-slate-700">Paramètres → Pompes</span> avant
                  que vous puissiez ouvrir une relève.
                </p>
                <div className="mt-4 w-full max-w-xs rounded-lg bg-slate-50 px-3 py-2.5 text-left text-[11px] text-slate-600 ring-1 ring-slate-100">
                  <p className="font-semibold text-slate-800">En attendant</p>
                  <p className="mt-1">Contactez le responsable station pour activer votre parc.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pumps.map((pump) => (
                  <li
                    key={pump.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">
                        {pump.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {pump.fuelTypeName} · {formatPriceXof(pump.pricePerLiter)} / L
                      </p>
                      {pump.status === "occupied" && pump.openedByName ? (
                        <p className="mt-1 truncate text-[11px] text-amber-800">
                          {pump.openedByName}
                          {pump.openedAt ? ` · ${formatWhen(pump.openedAt)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <PumpStatusChip status={pump.status} />
                      {pump.status === "mine" ? (
                        <InstantLink
                          href={sessionHref}
                          onClick={() => startNavProgress()}
                          className="mt-2 inline-flex text-[11px] font-semibold text-emerald-700 hover:underline"
                        >
                          Ouvrir fiche
                        </InstantLink>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-100 px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-slate-900">Équipe en relève</h2>
              {teamOnShift.length > 0 || hasOpenSession ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-sky-700">
                  {teamOnShift.length + (hasOpenSession ? 1 : 0)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!hasOpenSession && teamOnShift.length === 0 ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Users className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-slate-900">Aucune relève en cours</p>
                <p className="mt-1 max-w-sm text-[12px] text-slate-500">
                  {canOpenShift
                    ? "Ouvrez votre relève pour démarrer la fiche journalière."
                    : pumps.length === 0
                      ? "Configurez d'abord le parc pompes."
                      : "Attendez qu'une pompe se libère ou contactez votre responsable."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {hasOpenSession && ownSession ? (
                  <li className="flex items-center justify-between gap-3 bg-emerald-50/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">
                        {ownSession.openedByName ?? firstName}{" "}
                        <span className="font-normal text-emerald-700">(vous)</span>
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {ownSession.fuelPumpName} · {formatWhen(ownSession.openedAt)}
                      </p>
                    </div>
                    <PumpStatusChip status="mine" />
                  </li>
                ) : null}
                {teamOnShift.map((session) => {
                  const pump = pumps.find((p) => p.id === session.fuelPumpId);
                  return (
                    <li
                      key={session.fuelPumpId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {session.openedByName ?? "Pompiste"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {pump?.name ?? "Pompe"} · {formatWhen(session.openedAt)}
                        </p>
                      </div>
                      <PumpStatusChip status="occupied" />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {!hasOpenSession && pumps.length > 0 && availablePumpCount > 0 ? (
        <section className="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 ring-1 ring-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-emerald-900">Prêt à démarrer</p>
              <p className="mt-0.5 text-[11px] text-emerald-800/80">
                {availablePumpCount} pompe{availablePumpCount > 1 ? "s" : ""} disponible
                {availablePumpCount > 1 ? "s" : ""} — choisissez la vôtre et confirmez l&apos;index de
                départ.
              </p>
            </div>
            <InstantLink
              href={sessionHref}
              onClick={() => startNavProgress()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white transition hover:bg-emerald-500"
            >
              <Unlock className="h-3.5 w-3.5" />
              Ouvrir ma relève
            </InstantLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
