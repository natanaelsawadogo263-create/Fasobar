"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  ClipboardList,
  DoorClosed,
  PackagePlus,
  ShoppingCart,
  TrendingUp,
  Wine,
  UtensilsCrossed,
} from "lucide-react";

import type { AdminDashboardData } from "@/lib/admin/dashboard-queries";
import { formatPriceXof } from "@/lib/orders/constants";

type AdminDashboardWorkspaceProps = {
  data: AdminDashboardData;
};

function trendLabel(today: number, yesterday: number): {
  text: string;
  up: boolean;
  flat: boolean;
} {
  if (yesterday <= 0) {
    return {
      text: today > 0 ? "+100 % vs hier" : "Stable vs hier",
      up: today > 0,
      flat: today === 0,
    };
  }
  const change = ((today - yesterday) / yesterday) * 100;
  if (Math.abs(change) < 0.05) {
    return { text: "Stable vs hier", up: true, flat: true };
  }
  return {
    text: `${change >= 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")} % vs hier`,
    up: change >= 0,
    flat: false,
  };
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayLabel(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function AdminDashboardWorkspace({ data }: AdminDashboardWorkspaceProps) {
  const { kpis, liveOps, salesByDept, salesByHour } = data;
  const salesTrend = trendLabel(kpis.salesToday, kpis.salesYesterday);
  const ordersTrend = trendLabel(kpis.ordersToday, kpis.ordersYesterday);
  const openedAt = kpis.openCashOpenedAt
    ? new Date(kpis.openCashOpenedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const openSessionsCount = data.cashSessions.filter((s) => s.status === "OPEN").length;
  const activity = data.activity.slice(0, 12);
  const topProducts = data.topProducts.slice(0, 8);

  const deptTotal = salesByDept.bar + salesByDept.kitchen + salesByDept.other;
  const hourMax = Math.max(...salesByHour, 1);
  const hasHourlySales = salesByHour.some((value) => value > 0);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden px-4 py-3 lg:gap-5 lg:px-6 lg:py-5">
      <header className="flex shrink-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Tableau de bord
          </h1>
          <p className="mt-1 text-[13px] capitalize text-slate-500">{todayLabel()}</p>
        </div>
        <p className="hidden text-right text-[12px] text-slate-400 sm:block">
          Données live · même vérité que Caisse et Bar
        </p>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          accent="border-l-emerald-500"
          icon={<TrendingUp className="h-4 w-4" />}
          iconClass="bg-emerald-50 text-emerald-700"
          label="Ventes du jour"
          value={formatPriceXof(kpis.salesToday)}
          sub={<TrendBadge trend={salesTrend} />}
        />
        <KpiCard
          accent="border-l-sky-500"
          icon={<ShoppingCart className="h-4 w-4" />}
          iconClass="bg-sky-50 text-sky-700"
          label="Commandes du jour"
          value={String(kpis.ordersToday)}
          sub={<TrendBadge trend={ordersTrend} />}
        />
        <KpiCard
          accent="border-l-teal-500"
          icon={<Banknote className="h-4 w-4" />}
          iconClass="bg-teal-50 text-teal-700"
          label="Solde caisses ouvertes"
          value={formatPriceXof(kpis.openCashBalance ?? 0)}
          sub={
            openSessionsCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {openSessionsCount} ouverte{openSessionsCount > 1 ? "s" : ""}
                {openedAt ? ` · dès ${openedAt}` : ""}
              </span>
            ) : (
              <span className="text-slate-400">Aucune caisse ouverte</span>
            )
          }
        />
        <KpiCard
          accent={kpis.stockAlertCount > 0 ? "border-l-orange-500" : "border-l-slate-300"}
          icon={<AlertTriangle className="h-4 w-4" />}
          iconClass={
            kpis.stockAlertCount > 0
              ? "bg-orange-50 text-orange-700"
              : "bg-slate-100 text-slate-500"
          }
          label="Alertes stock"
          value={String(kpis.stockAlertCount)}
          sub={
            <Link
              href="/application/stock"
              className="font-medium text-slate-600 hover:text-emerald-700 hover:underline"
            >
              Voir le stock
            </Link>
          }
        />
      </div>

      <section className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm lg:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Ops en direct</h2>
            <p className="text-[12px] text-slate-500">
              Commandes, bar, cuisine et sessions — synchronisés en temps réel
            </p>
          </div>
          <Link
            href="/application/commandes"
            className="text-[12px] font-medium text-emerald-700 hover:underline"
          >
            Voir les commandes
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <LiveStat label="Ouvertes" value={liveOps.openOrdersCount} hint="non payées" />
          <LiveStat label="À encaisser" value={liveOps.readyToPayCount} hint="caisse" />
          <LiveStat
            label="Bar à faire"
            value={liveOps.barToPrepareCount + liveOps.barInPrepCount}
            hint={`${liveOps.barReadyCount} prêtes`}
          />
          <LiveStat
            label="Cuisine"
            value={liveOps.kitchenToPrepareCount}
            hint={`${liveOps.kitchenReadyCount} prêtes`}
          />
          <LiveStat
            label="Caisses"
            value={liveOps.openCashSessionsCount}
            hint="sessions ouvertes"
          />
          <LiveStat
            label="Service bar"
            value={liveOps.openBarSession ? 1 : 0}
            hint={
              liveOps.openBarSession
                ? liveOps.openBarSession.openedByName
                : "fermé"
            }
          />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-2 lg:gap-4">
        <Panel
          title="Produits les plus vendus"
          action={
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Aujourd&apos;hui · Top {topProducts.length}
            </span>
          }
        >
          {topProducts.length === 0 ? (
            <EmptyState message="Aucune vente enregistrée aujourd'hui." />
          ) : (
            <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
              <ul className="app-scroll min-h-0 space-y-1 overflow-y-auto">
                {topProducts.map((product, index) => {
                  const maxRevenue = topProducts[0]?.revenue || 1;
                  const width = Math.max(8, Math.round((product.revenue / maxRevenue) * 100));
                  return (
                    <li key={product.name} className="rounded-lg px-1.5 py-2 hover:bg-slate-50">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-500">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[12px] font-semibold text-slate-900">
                              {product.name}
                            </p>
                            <p className="shrink-0 text-[12px] font-bold tabular-nums text-emerald-700">
                              {formatPriceXof(product.revenue)}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {product.quantity} unité{product.quantity > 1 ? "s" : ""}
                          </p>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500/80"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Répartition
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <DeptBar
                      icon={<Wine className="h-3.5 w-3.5" />}
                      label="Bar"
                      amount={salesByDept.bar}
                      total={deptTotal}
                      tone="bg-emerald-500"
                    />
                    <DeptBar
                      icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
                      label="Cuisine"
                      amount={salesByDept.kitchen}
                      total={deptTotal}
                      tone="bg-sky-500"
                    />
                    {salesByDept.other > 0 ? (
                      <DeptBar
                        icon={<PackagePlus className="h-3.5 w-3.5" />}
                        label="Autre"
                        amount={salesByDept.other}
                        total={deptTotal}
                        tone="bg-slate-400"
                      />
                    ) : null}
                  </div>
                </div>

                {hasHourlySales ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Rythme du jour
                    </p>
                    <div className="mt-2 flex h-14 items-end gap-0.5">
                      {salesByHour.map((value, hour) => (
                        <div
                          key={hour}
                          title={`${hour}h · ${formatPriceXof(value)}`}
                          className="min-w-0 flex-1 rounded-sm bg-emerald-500/80"
                          style={{
                            height: `${Math.max(value > 0 ? 12 : 4, Math.round((value / hourMax) * 100))}%`,
                            opacity: value > 0 ? 1 : 0.15,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-slate-400">
                      <span>0h</span>
                      <span>12h</span>
                      <span>23h</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Activité récente"
          action={
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Dernières opérations
            </span>
          }
        >
          {activity.length === 0 ? (
            <EmptyState message="Aucune activité récente." />
          ) : (
            <ul className="app-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50/90"
                >
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      item.kind === "payment"
                        ? "bg-emerald-50 text-emerald-600"
                        : item.kind === "stock"
                          ? "bg-sky-50 text-sky-600"
                          : item.kind === "session"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.kind === "payment" ? (
                      <CircleDollarSign className="h-3.5 w-3.5" />
                    ) : item.kind === "stock" ? (
                      <PackagePlus className="h-3.5 w-3.5" />
                    ) : item.kind === "session" ? (
                      <DoorClosed className="h-3.5 w-3.5" />
                    ) : (
                      <ClipboardList className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-slate-900">{item.title}</p>
                      <p className="shrink-0 text-[10px] tabular-nums text-slate-400">
                        {relativeTime(item.at)}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function TrendBadge({
  trend,
}: {
  trend: { text: string; up: boolean; flat: boolean };
}) {
  if (trend.flat) {
    return <span className="font-medium text-slate-500">{trend.text}</span>;
  }
  const Icon = trend.up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-medium ${
        trend.up ? "text-emerald-600" : "text-red-500"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {trend.text}
    </span>
  );
}

function KpiCard({
  accent,
  icon,
  iconClass,
  label,
  value,
  sub,
}: {
  accent: string;
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: string;
  sub: ReactNode;
}) {
  return (
    <article
      className={`rounded-xl border border-slate-200/90 border-l-4 bg-white px-3.5 py-3.5 shadow-sm ${accent}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-[17px] font-bold tracking-tight tabular-nums text-slate-900 lg:text-[18px]">
            {value}
          </p>
          <div className="mt-1.5 text-[11px]">{sub}</div>
        </div>
      </div>
    </article>
  );
}

function LiveStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="truncate text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-[12px] text-slate-400">
      {message}
    </div>
  );
}

function DeptBar({
  icon,
  label,
  amount,
  total,
  tone,
}: {
  icon: ReactNode;
  label: string;
  amount: number;
  total: number;
  tone: string;
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
          {icon}
          {label}
        </span>
        <span className="tabular-nums text-slate-500">
          {pct}% · {formatPriceXof(amount)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
