import type { PlatformDashboardData } from "@/lib/platform/dashboard-queries";

const STATUS_LABELS: Record<string, string> = {
  PENDING_CHOICE: "Choix en attente",
  TRIAL: "Essai",
  TRIAL_EXPIRED: "Essai expiré",
  ACTIVE: "Actif",
  EXPIRED: "Expiré",
  SUSPENDED: "Suspendu",
  PENDING_DELETION: "Suppression",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING_CHOICE: "bg-amber-50 text-amber-800 ring-amber-200",
    TRIAL: "bg-sky-50 text-sky-800 ring-sky-200",
    TRIAL_EXPIRED: "bg-orange-50 text-orange-800 ring-orange-200",
    ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    EXPIRED: "bg-slate-100 text-slate-700 ring-slate-200",
    SUSPENDED: "bg-red-50 text-red-800 ring-red-200",
    PENDING_DELETION: "bg-rose-50 text-rose-800 ring-rose-200",
  };

  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        styles[status] ?? "bg-slate-50 text-slate-700 ring-slate-200"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

type PlatformDashboardProps = {
  data: PlatformDashboardData;
};

export function PlatformDashboard({ data }: PlatformDashboardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200/80 bg-[#f4f6f9] px-4 py-3 lg:px-5">
        <p className="text-sm text-slate-600">
          Vue d&apos;ensemble des clients FasoBar — données en temps réel.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 lg:px-5">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Clients" value={data.totalClients} hint="Organisations" />
            <MetricCard label="PENDING_CHOICE" value={data.pendingChoice} hint="Choix à faire" />
            <MetricCard label="Essais actifs" value={data.activeTrials} />
            <MetricCard label="Essais expirés" value={data.expiredTrials} />
            <MetricCard label="Clients ACTIVE" value={data.activeClients} />
            <MetricCard label="SUSPENDED" value={data.suspendedClients} />
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <div className="shrink-0 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Derniers clients créés</h2>
                <p className="text-[12px] text-slate-500">
                  Client = OWNER principal de l&apos;organisation
                </p>
              </div>
              <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Client (OWNER)</th>
                      <th className="px-4 py-2.5 font-semibold">Organisation</th>
                      <th className="px-4 py-2.5 font-semibold">Statut SaaS</th>
                      <th className="px-4 py-2.5 font-semibold">Créé le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentClients.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          Aucun client pour le moment.
                        </td>
                      </tr>
                    ) : (
                      data.recentClients.map((client) => (
                        <tr key={client.organizationId} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {client.ownerName ?? "OWNER non renseigné"}
                            </p>
                            {client.ownerPhone ? (
                              <p className="text-[12px] text-slate-500">{client.ownerPhone}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{client.organizationName}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={client.accessStatus} />
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {formatDate(client.organizationCreatedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <div className="shrink-0 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Essais proches de l&apos;expiration
                </h2>
                <p className="text-[12px] text-slate-500">Dans les 7 prochains jours</p>
              </div>
              <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
                <table className="w-full min-w-[480px] text-left text-[13px]">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Client</th>
                      <th className="px-4 py-2.5 font-semibold">Organisation</th>
                      <th className="px-4 py-2.5 font-semibold">Fin d&apos;essai</th>
                      <th className="px-4 py-2.5 font-semibold">Jours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.trialsNearExpiry.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          Aucun essai n&apos;expire dans les 7 jours.
                        </td>
                      </tr>
                    ) : (
                      data.trialsNearExpiry.map((trial) => (
                        <tr key={trial.trialId} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {trial.ownerName ?? "OWNER non renseigné"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{trial.organizationName}</td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {formatDate(trial.endsAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                              {trial.daysRemaining} j
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
