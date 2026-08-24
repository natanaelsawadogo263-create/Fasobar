import type { ComponentType, ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { InstantLink } from "@/components/layout/instant-link";
import { PlatformExpiryAlertCard } from "@/components/platform/platform-expiry-alert-card";
import {
  PlatformAlert,
  PlatformBody,
  PlatformEmptyState,
  PlatformPage,
  PlatformPanel,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import type { PlatformDashboardData } from "@/lib/platform/dashboard-queries";

type PlatformDashboardProps = {
  data: PlatformDashboardData;
};

function monthLabel(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function fullDateLabel(): string {
  const raw = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  // Majuscule uniquement sur la première lettre (fr-FR renvoie tout en minuscules).
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function MetricTile({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const tones = {
    neutral: "border-slate-200/90 bg-white",
    success: "border-emerald-200/80 bg-emerald-50/40",
    warning: "border-amber-200/80 bg-amber-50/50",
    info: "border-sky-200/80 bg-sky-50/40",
  } as const;

  const iconTones = {
    neutral: "bg-slate-100 text-slate-500",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-sky-100 text-sky-700",
  } as const;

  const body = (
    <div
      className={`flex min-h-[5.5rem] flex-col justify-between rounded-xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${tones[tone]} ${
        href ? "transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {label}
        </p>
        {Icon ? (
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconTones[tone]}`}
            aria-hidden
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-slate-900">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 truncate text-[11px] text-slate-500">{hint}</p>
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

const PORTFOLIO_STAT_TONES = {
  success: {
    card: "border-emerald-100 bg-emerald-50/50",
    icon: "bg-emerald-100 text-emerald-700",
  },
  info: {
    card: "border-sky-100 bg-sky-50/50",
    icon: "bg-sky-100 text-sky-700",
  },
  warning: {
    card: "border-amber-100 bg-amber-50/50",
    icon: "bg-amber-100 text-amber-700",
  },
  orange: {
    card: "border-orange-100 bg-orange-50/50",
    icon: "bg-orange-100 text-orange-700",
  },
  danger: {
    card: "border-rose-100 bg-rose-50/50",
    icon: "bg-rose-100 text-rose-700",
  },
  neutral: {
    card: "border-slate-200/80 bg-slate-50/60",
    icon: "bg-slate-200/70 text-slate-500",
  },
} as const;

function PortfolioStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof PORTFOLIO_STAT_TONES;
}) {
  const t = PORTFOLIO_STAT_TONES[tone];

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${t.card}`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${t.icon}`}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-600">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[20px] font-bold tabular-nums leading-none tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

export function PlatformDashboard({ data }: PlatformDashboardProps) {
  const pendingTotal =
    data.pendingOpeningRequests + data.pendingRequests;

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
          <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-emerald-50/60 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
            <div
              className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-emerald-200/25 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-100/40 blur-3xl"
              aria-hidden
            />

            <div className="relative flex min-w-0 items-center gap-3.5">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-700/20 sm:h-14 sm:w-14">
                <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Vue d&rsquo;ensemble
                </p>
                <h2 className="mt-0.5 text-[20px] font-bold tracking-tight text-slate-900 sm:text-[23px]">
                  Aperçu de la plateforme
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {fullDateLabel()}
                </p>
              </div>
            </div>

            {/* KPI — défilement mobile */}
            <div className="relative -mx-1 mt-4 flex gap-2.5 overflow-x-auto px-1 pb-0.5 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="Clients"
                  value={data.totalClients}
                  hint="Organisations"
                  href="/platform/clients"
                  icon={Users}
                />
              </div>
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="Abonnés actifs"
                  value={data.activeClients}
                  hint={`${data.suspendedClients} suspendu${data.suspendedClients > 1 ? "s" : ""}`}
                  href="/platform/abonnements"
                  icon={CheckCircle2}
                  tone="success"
                />
              </div>
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="À traiter"
                  value={pendingTotal}
                  hint={`${data.pendingOpeningRequests} ouv. · ${data.pendingRequests} paie.`}
                  href="/platform/demandes-etablissement"
                  icon={AlertCircle}
                  tone={pendingTotal > 0 ? "warning" : "neutral"}
                />
              </div>
              <div className="w-[42%] min-w-[9.5rem] shrink-0 lg:w-auto lg:min-w-0">
                <MetricTile
                  label="CA du mois"
                  value={formatPlatformXof(data.revenueThisMonthXof)}
                  hint={`${data.paymentsThisMonth} paiement${data.paymentsThisMonth > 1 ? "s" : ""}`}
                  icon={TrendingUp}
                  tone="info"
                />
              </div>
            </div>
          </section>

          {/* Corps principal */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* File d'attente */}
            <div className="lg:col-span-5">
              <PlatformPanel
                title="À traiter"
                description="File opérationnelle"
                icon={AlertCircle}
                tone={pendingTotal > 0 ? "warning" : "neutral"}
                dense
              >
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
                icon={TrendingUp}
                tone="info"
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
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"
                  >
                    <Wallet className="h-3.5 w-3.5 text-slate-400" />
                    Valider paiements
                  </InstantLink>
                  <InstantLink
                    href="/platform/abonnements"
                    prefetch
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"
                  >
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" />
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
                icon={Users}
                dense
              >
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  <PortfolioStat
                    label="Abonnés actifs"
                    value={data.activeClients}
                    icon={CheckCircle2}
                    tone="success"
                  />
                  <PortfolioStat
                    label="Essais en cours"
                    value={data.activeTrials}
                    icon={Clock}
                    tone="info"
                  />
                  <PortfolioStat
                    label="Choix en attente"
                    value={data.pendingChoice}
                    icon={HelpCircle}
                    tone="warning"
                  />
                  <PortfolioStat
                    label="Essais expirés"
                    value={data.expiredTrials}
                    icon={AlertTriangle}
                    tone="orange"
                  />
                  <PortfolioStat
                    label="Suspendus"
                    value={data.suspendedClients}
                    icon={Ban}
                    tone="danger"
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
                </div>
              </PlatformPanel>
            </div>
          </section>

          {/* Activité récente */}
          <section className="grid min-h-[240px] grid-cols-1 gap-4">
            <PlatformPanel
              title="Échéances"
              description={`Renouvellements sous ${data.warningDaysBeforeExpiry} j`}
              icon={Clock}
              tone={data.expiringAccess.length > 0 ? "warning" : "neutral"}
              dense
              className="min-h-[240px]"
              actions={
                data.expiringAccess.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-900">
                    <Clock className="h-3 w-3" />
                    {data.expiringAccess.length}
                  </span>
                ) : null
              }
            >
              <div className="app-scroll min-h-0 flex-1 overflow-auto p-3">
                {data.expiringAccess.length === 0 ? (
                  <PlatformEmptyState
                    title="Rien à renouveler"
                    description={`Aucun essai ni abonnement n'expire sous ${data.warningDaysBeforeExpiry} jours.`}
                  />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {data.expiringAccess.map((alert) => (
                      <PlatformExpiryAlertCard key={alert.id} alert={alert} />
                    ))}
                  </div>
                )}
              </div>
            </PlatformPanel>
          </section>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
