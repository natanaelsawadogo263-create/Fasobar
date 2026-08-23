import { InstantLink as Link } from "@/components/layout/instant-link";

import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import { listAdminStationPumpSessions } from "@/lib/admin/station-sessions-queries";
import { formatPriceXof } from "@/lib/products/constants";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";

export default async function StationBilansPage() {
  const workspace = await requireGasStationAdminContext();
  const today = toLocalIsoDate(new Date());
  const range = resolveOrderPeriodRange("day", today);
  const { sessions, closedCount } = await listAdminStationPumpSessions(workspace, {
    from: range.from,
    to: range.to,
    limit: 30,
  });

  const closed = sessions.filter((s) => s.status === "CLOSED");
  const totalCollected = closed.reduce((sum, s) => sum + (s.totalCollected ?? 0), 0);
  const totalLiters = closed.reduce((sum, s) => sum + (s.litersSold ?? 0), 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
      <header>
        <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Bilans du jour</h1>
        <p className="mt-1 text-[12px] text-slate-600">
          Synthèse rapide · {closedCount} session{closedCount > 1 ? "s" : ""} clôturée
          {closedCount > 1 ? "s" : ""}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium text-slate-500">Litres vendus</p>
          <p className="mt-1 text-[18px] font-bold text-slate-900">
            {totalLiters.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium text-slate-500">Encaissements</p>
          <p className="mt-1 text-[18px] font-bold text-emerald-700">{formatPriceXof(totalCollected)}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-1">
          <p className="text-[11px] font-medium text-slate-500">Sessions clôturées</p>
          <p className="mt-1 text-[18px] font-bold text-slate-900">{closed.length}</p>
        </div>
      </div>

      <Link
        href="/application/station/sessions"
        prefetch
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white active:bg-emerald-700"
      >
        Voir toutes les sessions
      </Link>
    </div>
  );
}
