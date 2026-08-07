import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PlatformStatusBadge } from "@/components/platform/platform-status-badge";
import {
  PLATFORM_TABLE_HEAD,
  PLATFORM_TD,
  PLATFORM_TH,
  PLATFORM_TR,
  PlatformAlert,
  PlatformBody,
  PlatformPage,
  formatPlatformDate,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import type { PlatformDashboardData } from "@/lib/platform/dashboard-queries";

type PlatformDashboardProps = {
  data: PlatformDashboardData;
};

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <div className="px-4 py-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block transition hover:bg-slate-50/80">
      {body}
    </Link>
  );
}

function PortfolioRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-slate-900">
        {value}
      </span>
    </div>
  );
}

function SideLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string | number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition hover:bg-slate-50"
    >
      <span className="text-[13px] text-slate-600">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-slate-900">
        {value}
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
      </span>
    </Link>
  );
}

export function PlatformDashboard({ data }: PlatformDashboardProps) {
  return (
    <PlatformPage>
      <PlatformBody className="!py-3 lg:!py-4">
        <div className="flex h-full min-h-0 flex-col gap-3">
          {data.error ? (
            <PlatformAlert tone="error">
              Impossible de charger le tableau de bord : {data.error}
            </PlatformAlert>
          ) : null}

          {/* Indicateurs clés — une seule bande */}
          <section className="shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 xl:grid-cols-4 xl:divide-y-0">
              <Metric
                label="Clients"
                value={data.totalClients}
                href="/platform/clients"
              />
              <Metric
                label="Abonnements actifs"
                value={data.activeClients}
                href="/platform/abonnements"
              />
              <Metric
                label="Demandes à traiter"
                value={data.pendingRequests}
                href="/platform/demandes-abonnement"
              />
              <Metric
                label="CA du mois"
                value={formatPlatformXof(data.revenueThisMonthXof)}
              />
            </div>
          </section>

          {/* Portefeuille + raccourcis */}
          <section className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-3">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-[12px] font-semibold text-slate-900">
                  Portefeuille clients
                </h2>
                <span className="text-[11px] text-slate-400">
                  {data.totalClients} organisation
                  {data.totalClients > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
                <div className="sm:pr-2">
                  <PortfolioRow
                    label="Choix essai / abonnement"
                    value={data.pendingChoice}
                    color="bg-amber-400"
                  />
                  <PortfolioRow
                    label="Essais en cours"
                    value={data.activeTrials}
                    color="bg-sky-400"
                  />
                  <PortfolioRow
                    label="Essais expirés"
                    value={data.expiredTrials}
                    color="bg-orange-400"
                  />
                </div>
                <div className="sm:pl-2">
                  <PortfolioRow
                    label="Abonnés actifs"
                    value={data.activeClients}
                    color="bg-emerald-500"
                  />
                  <PortfolioRow
                    label="Suspendus"
                    value={data.suspendedClients}
                    color="bg-red-400"
                  />
                  <PortfolioRow
                    label="Machines actives"
                    value={data.activeMachines}
                    color="bg-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-2">
              <h2 className="mb-1 px-2.5 text-[12px] font-semibold text-slate-900">
                Accès rapides
              </h2>
              <div className="space-y-0.5">
                <SideLink
                  href="/platform/clients"
                  label="Clients"
                  value={data.totalClients}
                />
                <SideLink
                  href="/platform/demandes-abonnement"
                  label="Demandes d’abonnement"
                  value={data.pendingRequests}
                />
                <SideLink
                  href="/platform/abonnements"
                  label="Abonnements"
                  value={data.activeClients}
                />
                <SideLink
                  href="/platform/machines"
                  label="Machines"
                  value={data.activeMachines}
                />
              </div>
              <div className="mt-2 border-t border-slate-100 px-2.5 pt-2.5">
                <p className="text-[11px] text-slate-400">Paiements validés ce mois</p>
                <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-900">
                  {data.paymentsThisMonth}
                  <span className="ml-1.5 text-[12px] font-medium text-slate-500">
                    · {formatPlatformXof(data.revenueThisMonthXof)}
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* Listes — restent dans le viewport */}
          <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <h2 className="text-[12px] font-semibold text-slate-900">
                  Derniers clients
                </h2>
                <Link
                  href="/platform/clients"
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Voir tout
                </Link>
              </div>
              <div className="app-scroll min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[440px] text-left text-[12.5px]">
                  <thead className={PLATFORM_TABLE_HEAD}>
                    <tr>
                      <th className={`${PLATFORM_TH} !py-2`}>Client</th>
                      <th className={`${PLATFORM_TH} !py-2`}>Organisation</th>
                      <th className={`${PLATFORM_TH} !py-2`}>État</th>
                      <th className={`${PLATFORM_TH} !py-2`}>Créé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentClients.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-[12px] text-slate-500"
                        >
                          Aucun client.
                        </td>
                      </tr>
                    ) : (
                      data.recentClients.map((client) => (
                        <tr key={client.organizationId} className={PLATFORM_TR}>
                          <td className={`${PLATFORM_TD} !py-2`}>
                            <Link
                              href={`/platform/clients/${client.organizationId}`}
                              className="font-medium text-slate-900 hover:text-emerald-700"
                            >
                              {client.ownerName ?? "OWNER non renseigné"}
                            </Link>
                          </td>
                          <td className={`${PLATFORM_TD} !py-2 text-slate-600`}>
                            {client.organizationName}
                          </td>
                          <td className={`${PLATFORM_TD} !py-2`}>
                            <PlatformStatusBadge status={client.accessStatus} />
                          </td>
                          <td
                            className={`${PLATFORM_TD} !py-2 tabular-nums text-slate-500`}
                          >
                            {formatPlatformDate(client.organizationCreatedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <h2 className="text-[12px] font-semibold text-slate-900">
                  Essais à surveiller
                  <span className="ml-1.5 font-normal text-slate-400">· 7 j</span>
                </h2>
                <Link
                  href="/platform/clients"
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Clients
                </Link>
              </div>
              <div className="app-scroll min-h-0 flex-1 overflow-auto">
                {data.trialsNearExpiry.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[12px] text-slate-500">
                    Aucun essai n’expire sous 7 jours.
                  </p>
                ) : (
                  <table className="w-full min-w-[360px] text-left text-[12.5px]">
                    <thead className={PLATFORM_TABLE_HEAD}>
                      <tr>
                        <th className={`${PLATFORM_TH} !py-2`}>Client</th>
                        <th className={`${PLATFORM_TH} !py-2`}>Organisation</th>
                        <th className={`${PLATFORM_TH} !py-2`}>Jours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trialsNearExpiry.map((trial) => (
                        <tr key={trial.trialId} className={PLATFORM_TR}>
                          <td
                            className={`${PLATFORM_TD} !py-2 font-medium text-slate-900`}
                          >
                            {trial.ownerName ?? "OWNER non renseigné"}
                          </td>
                          <td className={`${PLATFORM_TD} !py-2 text-slate-600`}>
                            {trial.organizationName}
                          </td>
                          <td className={`${PLATFORM_TD} !py-2`}>
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                              {trial.daysRemaining} j
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
