import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  MonitorSmartphone,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { InstantLink } from "@/components/layout/instant-link";
import { PlatformExpiryAlertCard } from "@/components/platform/platform-expiry-alert-card";
import { PlatformStatusBadge } from "@/components/platform/platform-status-badge";
import {
  PLATFORM_TABLE_HEAD,
  PLATFORM_TD,
  PLATFORM_TH,
  PLATFORM_TR,
  PlatformAlert,
  PlatformBody,
  PlatformEmptyState,
  PlatformPage,
  PlatformPanel,
  formatPlatformDate,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import type { PlatformDashboardData } from "@/lib/platform/dashboard-queries";

type PlatformDashboardProps = {
  data: PlatformDashboardData;
};

const QUICK_LINKS = [
  {
    href: "/platform/demandes-etablissement",
    label: "Ouvertures",
    icon: Building2,
  },
  {
    href: "/platform/demandes-abonnement",
    label: "Paiements",
    icon: Wallet,
  },
  { href: "/platform/clients", label: "Clients", icon: Users },
  { href: "/platform/parametres", label: "Paramètres", icon: Settings },
] as const;

function monthLabel(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function MetricTile({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const tones = {
    neutral: "border-slate-200/90 bg-white",
    success: "border-emerald-200/80 bg-emerald-50/40",
    warning: "border-amber-200/80 bg-amber-50/50",
    info: "border-sky-200/80 bg-sky-50/40",
  } as const;

  const body = (
    <div
      className={`flex min-h-[5.5rem] flex-col justify-between rounded-xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${tones[tone]} ${
        href ? "transition hover:shadow-md active:scale-[0.99]" : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <div>
        <p className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-slate-900">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <InstantLink href={href} prefetch className="block">
      {body}
    </InstantLink>
  );
}

function PriorityRow({
  href,
  label,
  count,
  description,
}: {
  href: string;
  label: string;
  count: number;
  description: string;
}) {
  const urgent = count > 0;

  return (
    <InstantLink
      href={href}
      prefetch
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition active:scale-[0.99] ${
        urgent
          ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50"
          : "border-slate-200/90 bg-slate-50/50 hover:bg-white"
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold tabular-nums ${
          urgent
            ? "bg-amber-200 text-amber-950"
            : "bg-white text-slate-400 ring-1 ring-slate-200"
        }`}
      >
        {count}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-900">{label}</p>
        <p className="truncate text-[11px] text-slate-500">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
    </InstantLink>
  );
}

function PortfolioStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} />
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
          {label}
        </span>
        <span className="text-[15px] font-bold tabular-nums text-slate-900">
          {value}
        </span>
      </div>
    </div>
  );
}

export function PlatformDashboard({ data }: PlatformDashboardProps) {
  const pendingTotal =
    data.pendingOpeningRequests + data.pendingRequests;
  const allClear =
    pendingTotal === 0 && data.expiringAccess.length === 0;

  return (
    <PlatformPage>
      <PlatformBody className="app-scroll !overflow-y-auto !py-3 lg:!py-5">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 pb-3">
          {data.error ? (
            <PlatformAlert tone="error">
              Impossible de charger le tableau de bord : {data.error}
            </PlatformAlert>
          ) : null}

          {/* En-tête exécutif */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  Pilotage · {monthLabel()}
                </p>
                <h2 className="mt-1 text-[20px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
                  Pilotage plateforme
                </h2>
                <p className="mt-1 capitalize text-[13px] text-slate-500">
                  {todayLabel()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {allClear ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aucune action urgente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {pendingTotal + data.expiringAccess.length} point
                    {pendingTotal + data.expiringAccess.length > 1 ? "s" : ""}{" "}
                    à surveiller
                  </span>
                )}
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <InstantLink
                      key={link.href}
                      href={link.href}
                      prefetch
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"
                    >
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                      {link.label}
                    </InstantLink>
                  );
                })}
              </div>
            </div>

            {/* KPI — défilement mobile */}
            <div className="-mx-1 mt-4 flex gap-2.5 overflow-x-auto px-1 pb-0.5 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="Clients"
                  value={data.totalClients}
                  hint="Organisations"
                  href="/platform/clients"
                />
              </div>
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="Abonnés actifs"
                  value={data.activeClients}
                  hint={`${data.suspendedClients} suspendu${data.suspendedClients > 1 ? "s" : ""}`}
                  href="/platform/abonnements"
                  tone="success"
                />
              </div>
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="À traiter"
                  value={pendingTotal}
                  hint={`${data.pendingOpeningRequests} ouv. · ${data.pendingRequests} paie.`}
                  href="/platform/demandes-etablissement"
                  tone={pendingTotal > 0 ? "warning" : "neutral"}
                />
              </div>
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="CA du mois"
                  value={formatPlatformXof(data.revenueThisMonthXof)}
                  hint={`${data.paymentsThisMonth} paiement${data.paymentsThisMonth > 1 ? "s" : ""}`}
                  tone="info"
                />
              </div>
            </div>
          </section>

          {/* Corps principal */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* File d'attente */}
            <div className="lg:col-span-5">
              <PlatformPanel title="À traiter" description="File opérationnelle" dense>
                <div className="space-y-2 p-3 pt-2">
                  <PriorityRow
                    href="/platform/demandes-etablissement"
                    label="Ouvertures"
                    count={data.pendingOpeningRequests}
                    description="Nouvelles inscriptions à confirmer"
                  />
                  <PriorityRow
                    href="/platform/demandes-abonnement"
                    label="Paiements"
                    count={data.pendingRequests}
                    description="Preuves Orange Money à valider"
                  />
                  <PriorityRow
                    href="/platform/clients"
                    label="Échéances proches"
                    count={data.expiringAccess.length}
                    description={`Essais / abos sous ${data.warningDaysBeforeExpiry} jours`}
                  />
                </div>
              </PlatformPanel>

              <PlatformPanel
                title="Revenus"
                description={monthLabel()}
                dense
                className="mt-4"
              >
                <div className="flex items-center gap-4 p-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[24px] font-bold tabular-nums tracking-tight text-slate-900">
                      {formatPlatformXof(data.revenueThisMonthXof)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {data.paymentsThisMonth} paiement
                      {data.paymentsThisMonth > 1 ? "s" : ""} validé
                      {data.paymentsThisMonth > 1 ? "s" : ""} ce mois
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
                  <InstantLink
                    href="/platform/demandes-abonnement"
                    prefetch
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Wallet className="h-4 w-4 text-slate-400" />
                    Valider paiements
                  </InstantLink>
                  <InstantLink
                    href="/platform/abonnements"
                    prefetch
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <CreditCard className="h-4 w-4 text-slate-400" />
                    Voir abonnements
                  </InstantLink>
                </div>
              </PlatformPanel>
            </div>

            {/* Portefeuille */}
            <div className="lg:col-span-7">
              <PlatformPanel
                title="Portefeuille"
                description={`${data.totalClients} organisation${data.totalClients > 1 ? "s" : ""}`}
                dense
              >
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  <PortfolioStat
                    label="Abonnés actifs"
                    value={data.activeClients}
                    tone="bg-emerald-500"
                  />
                  <PortfolioStat
                    label="Essais en cours"
                    value={data.activeTrials}
                    tone="bg-sky-400"
                  />
                  <PortfolioStat
                    label="Choix en attente"
                    value={data.pendingChoice}
                    tone="bg-amber-400"
                  />
                  <PortfolioStat
                    label="Essais expirés"
                    value={data.expiredTrials}
                    tone="bg-orange-400"
                  />
                  <PortfolioStat
                    label="Suspendus"
                    value={data.suspendedClients}
                    tone="bg-red-400"
                  />
                  <PortfolioStat
                    label="Machines actives"
                    value={data.activeMachines}
                    tone="bg-slate-400"
                  />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2.5">
                  <InstantLink
                    href="/platform/clients"
                    prefetch
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Tous les clients
                  </InstantLink>
                  <InstantLink
                    href="/platform/machines"
                    prefetch
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <MonitorSmartphone className="h-3.5 w-3.5" />
                    Machines ({data.activeMachines})
                  </InstantLink>
                </div>
              </PlatformPanel>
            </div>
          </section>

          {/* Activité récente */}
          <section className="grid min-h-[300px] grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <PlatformPanel
              title="Derniers clients"
              description="Inscriptions récentes"
              dense
              className="min-h-[300px]"
              actions={
                <InstantLink
                  href="/platform/clients"
                  prefetch
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Voir tout
                </InstantLink>
              }
            >
              {data.recentClients.length === 0 ? (
                <PlatformEmptyState
                  title="Aucun client"
                  description="Les nouvelles organisations apparaîtront ici."
                />
              ) : (
                <div className="app-scroll min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-[420px] text-left text-[12.5px]">
                    <thead className={PLATFORM_TABLE_HEAD}>
                      <tr>
                        <th className={`${PLATFORM_TH} !py-2`}>Propriétaire</th>
                        <th className={`${PLATFORM_TH} !py-2`}>Organisation</th>
                        <th className={`${PLATFORM_TH} !py-2`}>État</th>
                        <th className={`${PLATFORM_TH} !py-2`}>Inscrit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentClients.map((client) => (
                        <tr key={client.organizationId} className={PLATFORM_TR}>
                          <td className={`${PLATFORM_TD} !py-2.5`}>
                            <InstantLink
                              href={`/platform/clients/${client.organizationId}`}
                              prefetch
                              className="font-medium text-slate-900 hover:text-emerald-700"
                            >
                              {client.ownerName ?? "—"}
                            </InstantLink>
                          </td>
                          <td className={`${PLATFORM_TD} !py-2.5 text-slate-600`}>
                            {client.organizationName}
                          </td>
                          <td className={`${PLATFORM_TD} !py-2.5`}>
                            <PlatformStatusBadge status={client.accessStatus} />
                          </td>
                          <td
                            className={`${PLATFORM_TD} !py-2.5 tabular-nums text-slate-500`}
                          >
                            {formatPlatformDate(client.organizationCreatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PlatformPanel>

            <PlatformPanel
              title="Échéances"
              description={`Renouvellements sous ${data.warningDaysBeforeExpiry} j`}
              dense
              className="min-h-[300px]"
              actions={
                data.expiringAccess.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-900">
                    <Clock className="h-3 w-3" />
                    {data.expiringAccess.length}
                  </span>
                ) : null
              }
            >
              <div className="app-scroll min-h-0 flex-1 space-y-2 overflow-auto p-3">
                {data.expiringAccess.length === 0 ? (
                  <PlatformEmptyState
                    title="Rien à renouveler"
                    description={`Aucun essai ni abonnement n'expire sous ${data.warningDaysBeforeExpiry} jours.`}
                  />
                ) : (
                  data.expiringAccess.map((alert) => (
                    <PlatformExpiryAlertCard key={alert.id} alert={alert} />
                  ))
                )}
              </div>
            </PlatformPanel>
          </section>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
