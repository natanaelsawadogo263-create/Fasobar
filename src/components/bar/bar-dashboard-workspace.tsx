"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  GlassWater,
  Package,
  PackagePlus,
} from "lucide-react";

import type { BarDashboardData } from "@/lib/bar/queries";
import {
  formatBarAge,
  formatBarOrderNumber,
  BAR_STATUS_LABELS,
} from "@/lib/bar/constants";
import type { BarSessionDetail } from "@/lib/bar/session-types";
import { formatPriceXof } from "@/lib/orders/constants";
import { formatQuantity } from "@/lib/stock/constants";

type BarDashboardWorkspaceProps = {
  data: BarDashboardData;
  openSession?: BarSessionDetail | null;
  managerName?: string;
};

export function BarDashboardWorkspace({
  data,
  openSession = null,
  managerName = "Responsable Bar",
}: BarDashboardWorkspaceProps) {
  const ownSession = openSession?.isOwnSession ? openSession : null;
  const heldByOther = openSession && !openSession.isOwnSession;
  const pendingOrders = data.toPrepare + data.inPreparation;

  const kpis = [
    {
      label: "À préparer",
      value: data.toPrepare,
      href: "/application/bar/commandes",
      icon: GlassWater,
      tone: "text-amber-700",
      iconWrap: "bg-amber-50 text-amber-600",
      ring: "ring-amber-100",
    },
    {
      label: "En préparation",
      value: data.inPreparation,
      href: "/application/bar/commandes",
      icon: Clock3,
      tone: "text-sky-700",
      iconWrap: "bg-sky-50 text-sky-600",
      ring: "ring-sky-100",
    },
    {
      label: "Prêtes",
      value: data.ready,
      href: "/application/bar/commandes",
      icon: CheckCircle2,
      tone: "text-emerald-700",
      iconWrap: "bg-emerald-50 text-emerald-600",
      ring: "ring-emerald-100",
    },
    {
      label: "Stock faible",
      value: data.lowStock,
      href: "/application/bar/stock",
      icon: AlertTriangle,
      tone: "text-orange-700",
      iconWrap: "bg-orange-50 text-orange-600",
      ring: "ring-orange-100",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-4 py-4 lg:gap-5 lg:px-6 lg:py-5">
      {/* En-tête + statut service */}
      <header className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
              Tableau de bord
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Vue d&apos;ensemble du bar — commandes et stock
            </p>
          </div>

          {ownSession ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 ring-1 ring-emerald-200/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[12px] font-semibold text-emerald-800">
                  Service ouvert
                </span>
                <span className="hidden text-[12px] text-emerald-700/70 sm:inline">
                  · {ownSession.openedByName ?? managerName} · depuis{" "}
                  {new Date(ownSession.openedAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <Link
                href="/application/bar/session"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-[12px] font-semibold text-white transition hover:bg-slate-800"
              >
                Bilan / Clôturer
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : heldByOther && openSession ? (
            <div className="inline-flex max-w-md items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200/80">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span className="truncate text-[12px] text-amber-900">
                <span className="font-semibold">Relève en attente</span>
                <span className="text-amber-800/70">
                  {" "}
                  · {openSession.openedByName ?? "Autre responsable"}
                </span>
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="text-[12px] font-semibold text-slate-600">
                Service fermé
              </span>
            </div>
          )}
        </div>

        {/* Actions principales */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/application/bar/commandes"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <GlassWater className="h-3.5 w-3.5" />
            Commandes
            {pendingOrders > 0 ? (
              <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums">
                {pendingOrders}
              </span>
            ) : null}
          </Link>
          <Link
            href="/application/bar/approvisionnements"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Entrée stock
          </Link>
          <Link
            href="/application/bar/stock"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Package className="h-3.5 w-3.5" />
            Stock
            {data.lowStock > 0 ? (
              <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-orange-700">
                {data.lowStock}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className={`group rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200/80 transition hover:ring-2 ${kpi.ring}`}
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
                    className={`mt-0.5 text-[26px] font-bold leading-none tabular-nums ${kpi.tone}`}
                  >
                    {kpi.value}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Listes */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2 lg:gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-100 px-4">
            <h2 className="text-[13px] font-semibold text-slate-900">
              Commandes boissons
            </h2>
            <Link
              href="/application/bar/commandes"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
            >
              Board
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {data.recentOrders.length === 0 ? (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center px-4 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <GlassWater className="h-5 w-5" />
                </span>
                <p className="mt-2.5 text-[13px] font-medium text-slate-700">
                  Aucune commande en cours
                </p>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  Les tickets boissons apparaîtront ici.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900">
                        {formatBarOrderNumber(order.orderNumber)}
                        <span className="ml-2 font-normal text-slate-400">
                          {order.tableReference ||
                            order.customerReference ||
                            "Sans table"}
                        </span>
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {order.items.map((item) => (
                          <li key={item.id} className="truncate text-[11px] text-slate-600">
                            <span className="font-bold text-emerald-700">{item.quantity}×</span>{" "}
                            {item.productName}
                            <span className="ml-1 text-slate-400">
                              · {formatPriceXof(item.lineTotal)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusChip status={order.barStatus} />
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatBarAge(
                          order.barStatusUpdatedAt ?? order.createdAt,
                        )}
                      </p>
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
              <h2 className="text-[13px] font-semibold text-slate-900">
                Alertes stock
              </h2>
              {data.lowStock > 0 ? (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-orange-700">
                  {data.lowStock}
                </span>
              ) : null}
            </div>
            <Link
              href="/application/bar/stock"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
            >
              Gérer
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {data.stockAlerts.length === 0 ? (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center px-4 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Package className="h-5 w-5" />
                </span>
                <p className="mt-2.5 text-[13px] font-medium text-slate-700">
                  Aucune alerte stock
                </p>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  Tous les produits sont au-dessus du seuil.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.stockAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">
                        {alert.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Stock{" "}
                        <span className="font-medium tabular-nums text-slate-700">
                          {formatQuantity(alert.currentQuantity, alert.unit)}
                        </span>
                        {" · "}
                        seuil {formatQuantity(alert.minimumQuantity, alert.unit)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        alert.status === "out"
                          ? "bg-red-50 text-red-700"
                          : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          alert.status === "out" ? "bg-red-500" : "bg-orange-500"
                        }`}
                      />
                      {alert.status === "out" ? "Rupture" : "Faible"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusChip({
  status,
}: {
  status: keyof typeof BAR_STATUS_LABELS;
}) {
  const styles =
    status === "READY"
      ? "bg-emerald-50 text-emerald-700"
      : status === "IN_PREPARATION"
        ? "bg-sky-50 text-sky-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles}`}
    >
      {BAR_STATUS_LABELS[status]}
    </span>
  );
}
