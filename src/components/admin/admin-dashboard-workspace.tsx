"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  TrendingDown,
  TrendingUp,
  Wallet,
  Wine,
  UtensilsCrossed,
} from "lucide-react";

import { getActivityProfile } from "@/lib/activity/profile";
import type {
  AdminDashboardData,
  AdminDashboardPeriod,
} from "@/lib/admin/dashboard-queries";
import { formatPriceXof } from "@/lib/orders/constants";
import {
  hasBarService,
  hasKitchenService,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type AdminDashboardWorkspaceProps = {
  data: AdminDashboardData;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
};

const PERIOD_OPTIONS: Array<{ id: AdminDashboardPeriod; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

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

function analysisTitle(period: AdminDashboardPeriod): string {
  if (period === "week") return "Analyse de la semaine";
  if (period === "month") return "Analyse du mois";
  return "Analyse du jour";
}

function rhythmTitle(period: AdminDashboardPeriod): string {
  if (period === "week") return "Rythme de la semaine";
  if (period === "month") return "Rythme du mois";
  return "Rythme du jour";
}

function emptySalesMessage(period: AdminDashboardPeriod): string {
  if (period === "week") return "Aucune vente cette semaine.";
  if (period === "month") return "Aucune vente ce mois.";
  return "Aucune vente aujourd'hui.";
}

export function AdminDashboardWorkspace({
  data,
  serviceScope = "BOTH",
  activityCode = null,
}: AdminDashboardWorkspaceProps) {
  const router = useRouter();
  const profile = getActivityProfile(activityCode);
  const retail = profile.kind === "retail";
  const { kpis, salesByDept, salesSeries, analysisPeriod, analysisPeriodLabel } =
    data;
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
  const topProducts = data.topProducts.slice(0, 12);

  const deptTotal = salesByDept.bar + salesByDept.kitchen + salesByDept.other;
  const seriesMax = Math.max(...salesSeries.values, 1);
  const hasSeriesSales = salesSeries.values.some((value) => value > 0);

  function setPeriod(period: AdminDashboardPeriod) {
    const params = new URLSearchParams();
    if (period !== "day") params.set("period", period);
    const query = params.toString();
    router.push(
      query
        ? `/application/tableau-de-bord?${query}`
        : "/application/tableau-de-bord",
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden px-3 py-2.5 lg:gap-3 lg:px-5 lg:py-3.5">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold leading-none tracking-tight text-slate-900 lg:text-[20px]">
            Tableau de bord
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            <span className="capitalize">{todayLabel()}</span>
            <span className="text-slate-300"> · </span>
            {profile.dashboardHint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white p-1 sm:h-8 sm:rounded-lg sm:p-0.5">
            {PERIOD_OPTIONS.map((option) => {
              const isActive = analysisPeriod === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriod(option.id)}
                  className={`h-9 rounded-lg px-3 text-[12px] font-semibold transition sm:h-7 sm:rounded-md sm:px-2.5 sm:text-[11px] ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 active:bg-slate-50 sm:hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="hidden text-right text-[11px] capitalize text-slate-400 sm:block">
            Stats · {analysisPeriodLabel}
          </p>
        </div>
      </header>

      {/* KPI mobile — bandeau horizontal */}
      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 lg:hidden">
        <div className="w-[42%] min-w-[9.5rem] shrink-0 rounded-xl border border-l-4 border-slate-200/90 border-l-emerald-500 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {retail ? "CA" : "Ventes"}
          </p>
          <p className="mt-1 truncate text-[15px] font-bold tabular-nums text-slate-900">
            {formatPriceXof(kpis.salesToday)}
          </p>
          <div className="mt-0.5">
            <TrendBadge trend={salesTrend} />
          </div>
        </div>
        <div className="w-[42%] min-w-[9.5rem] shrink-0 rounded-xl border border-l-4 border-slate-200/90 border-l-sky-500 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {retail ? "Dépenses" : "Commandes"}
          </p>
          <p className="mt-1 truncate text-[15px] font-bold tabular-nums text-slate-900">
            {retail ? formatPriceXof(kpis.expensesToday) : kpis.ordersToday}
          </p>
          <div className="mt-0.5">
            {retail ? (
              <span className="font-medium text-slate-500">Du jour</span>
            ) : (
              <TrendBadge trend={ordersTrend} />
            )}
          </div>
        </div>
        <div className="w-[42%] min-w-[9.5rem] shrink-0 rounded-xl border border-l-4 border-slate-200/90 border-l-teal-500 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {retail ? "Bénéfice" : "Caisses"}
          </p>
          <p className="mt-1 truncate text-[15px] font-bold tabular-nums text-slate-900">
            {retail
              ? formatPriceXof(kpis.profitToday)
              : formatPriceXof(kpis.openCashBalance ?? 0)}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400">
            {retail
              ? "CA − dépenses"
              : openSessionsCount > 0
                ? `${openSessionsCount} ouverte${openSessionsCount > 1 ? "s" : ""}`
                : "Aucune ouverte"}
          </p>
        </div>
        <div
          className={`w-[42%] min-w-[9.5rem] shrink-0 rounded-xl border border-l-4 border-slate-200/90 bg-white px-3 py-2.5 shadow-sm ${
            kpis.stockAlertCount > 0 ? "border-l-orange-500" : "border-l-slate-300"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Alertes
          </p>
          <p className="mt-1 truncate text-[15px] font-bold tabular-nums text-slate-900">
            {kpis.stockAlertCount}
          </p>
          <Link
            href="/application/stock"
            className="mt-0.5 inline-block text-[10px] font-medium text-emerald-700"
          >
            Voir le stock
          </Link>
        </div>
      </div>

      {/* KPI desktop */}
      <div className="hidden shrink-0 grid-cols-2 gap-2 lg:grid lg:grid-cols-4 lg:gap-2.5">
        <KpiCard
          accent="border-l-emerald-500"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          iconClass="bg-emerald-50 text-emerald-700"
          label={retail ? "Chiffre d’affaires" : "Ventes du jour"}
          value={formatPriceXof(kpis.salesToday)}
          sub={<TrendBadge trend={salesTrend} />}
        />
        <KpiCard
          accent="border-l-sky-500"
          icon={
            retail ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <ShoppingCart className="h-3.5 w-3.5" />
            )
          }
          iconClass="bg-sky-50 text-sky-700"
          label={retail ? "Dépenses du jour" : profile.ordersKpiLabel}
          value={
            retail ? formatPriceXof(kpis.expensesToday) : String(kpis.ordersToday)
          }
          sub={
            retail ? (
              <span className="font-medium text-slate-500">Sorties enregistrées</span>
            ) : (
              <TrendBadge trend={ordersTrend} />
            )
          }
        />
        <KpiCard
          accent="border-l-teal-500"
          icon={
            retail ? (
              <Wallet className="h-3.5 w-3.5" />
            ) : (
              <Banknote className="h-3.5 w-3.5" />
            )
          }
          iconClass="bg-teal-50 text-teal-700"
          label={retail ? "Bénéfice du jour" : "Solde caisses"}
          value={
            retail
              ? formatPriceXof(kpis.profitToday)
              : formatPriceXof(kpis.openCashBalance ?? 0)
          }
          sub={
            openSessionsCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {openSessionsCount} ouverte{openSessionsCount > 1 ? "s" : ""}
                {openedAt ? ` · ${openedAt}` : ""}
              </span>
            ) : (
              <span className="text-slate-400">Aucune ouverte</span>
            )
          }
        />
        <KpiCard
          accent={kpis.stockAlertCount > 0 ? "border-l-orange-500" : "border-l-slate-300"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
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

      <div className="grid min-h-0 flex-1 gap-2.5 overflow-y-auto lg:grid-cols-12 lg:gap-3 lg:overflow-hidden">
        <Panel
          className="min-h-0 lg:col-span-5"
          title={profile.topProductsTitle}
          action={
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">
              {analysisPeriodLabel} · Top {topProducts.length || 0}
            </span>
          }
        >
          {topProducts.length === 0 ? (
            <EmptyState message={emptySalesMessage(analysisPeriod)} />
          ) : (
            <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
              <ul className="space-y-0.5 px-2.5 py-1.5">
                {topProducts.map((product, index) => {
                  const maxRevenue = topProducts[0]?.revenue || 1;
                  const width = Math.max(
                    8,
                    Math.round((product.revenue / maxRevenue) * 100),
                  );
                  return (
                    <li
                      key={product.name}
                      className="rounded-lg px-1.5 py-1.5 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[12px] font-semibold text-slate-900">
                              {product.name}
                            </p>
                            <p className="shrink-0 text-[11px] font-bold tabular-nums text-emerald-700">
                              {formatPriceXof(product.revenue)}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {product.quantity} unité{product.quantity > 1 ? "s" : ""}
                          </p>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
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
            </div>
          )}
        </Panel>

        <Panel
          className="min-h-0 lg:col-span-3"
          title={analysisTitle(analysisPeriod)}
          action={
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {PERIOD_OPTIONS.find((o) => o.id === analysisPeriod)?.label}
            </span>
          }
        >
          <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-3">
            <div className="flex min-h-full flex-col justify-between gap-3">
              <div className="space-y-2">
                {hasBarService(serviceScope) ? (
                <DeptBar
                  icon={<Wine className="h-3.5 w-3.5" />}
                  label={retail ? profile.catalogDepartmentLabel : "Bar"}
                  amount={salesByDept.bar}
                  total={deptTotal}
                  tone="bg-emerald-500"
                />
                ) : null}
                {!retail && hasKitchenService(serviceScope) ? (
                <DeptBar
                  icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
                  label="Cuisine"
                  amount={salesByDept.kitchen}
                  total={deptTotal}
                  tone="bg-sky-500"
                />
                ) : null}
                {salesByDept.other > 0 ? (
                  <DeptBar
                    icon={<PackagePlus className="h-3.5 w-3.5" />}
                    label="Autre"
                    amount={salesByDept.other}
                    total={deptTotal}
                    tone="bg-slate-400"
                  />
                ) : null}
                {deptTotal === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    {emptySalesMessage(analysisPeriod)}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-slate-100 pt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {rhythmTitle(analysisPeriod)}
                </p>
                {hasSeriesSales ? (
                  <>
                    <div className="mt-2 flex h-12 items-end gap-px">
                      {salesSeries.values.map((value, index) => (
                        <div
                          key={`${salesSeries.labels[index]}-${index}`}
                          title={`${salesSeries.labels[index]} · ${formatPriceXof(value)}`}
                          className="min-w-0 flex-1 rounded-sm bg-emerald-500/80"
                          style={{
                            height: `${Math.max(value > 0 ? 10 : 3, Math.round((value / seriesMax) * 100))}%`,
                            opacity: value > 0 ? 1 : 0.15,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-slate-400">
                      <span>{salesSeries.labels[0]}</span>
                      <span>
                        {
                          salesSeries.labels[
                            Math.floor(salesSeries.labels.length / 2)
                          ]
                        }
                      </span>
                      <span>
                        {salesSeries.labels[salesSeries.labels.length - 1]}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Aucun pic sur cette période.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          className="min-h-0 lg:col-span-4"
          title="Activité récente"
          action={
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Live
            </span>
          }
        >
          {activity.length === 0 ? (
            <EmptyState message="Aucune activité récente." />
          ) : (
            <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
              <ul className="space-y-0.5 px-1.5 py-1.5">
                {activity.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50/90"
                  >
                    <span
                      className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
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
                        <p className="truncate text-[12px] font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="shrink-0 text-[10px] tabular-nums text-slate-400">
                          {relativeTime(item.at)}
                        </p>
                      </div>
                      <p className="truncate text-[11px] text-slate-500">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
      <Icon className="h-3 w-3" />
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
      className={`rounded-xl border border-slate-200/90 border-l-4 bg-white px-2.5 py-2 shadow-sm ${accent}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-slate-500">{label}</p>
          <p className="truncate text-[15px] font-bold tracking-tight tabular-nums text-slate-900 lg:text-[16px]">
            {value}
          </p>
          <div className="mt-0.5 text-[10px]">{sub}</div>
        </div>
      </div>
    </article>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-[220px] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm lg:h-full lg:min-h-0 ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h2 className="text-[12px] font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-3 py-6 text-center text-[11px] text-slate-400">
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
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
