"use client";

import { InstantLink } from "@/components/layout/instant-link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  DoorClosed,
  Package,
  PackagePlus,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wine,
} from "lucide-react";

import { getActivityProfile } from "@/lib/activity/profile";
import type {
  AdminDashboardData,
  AdminDashboardPeriod,
} from "@/lib/admin/dashboard-queries";
import { isRetailShopOps } from "@/lib/activity/ops-model";
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
      text: today > 0 ? "+100 % vs hier" : "Comme hier",
      up: today > 0,
      flat: today === 0,
    };
  }
  const change = ((today - yesterday) / yesterday) * 100;
  if (Math.abs(change) < 0.05) {
    return { text: "Comme hier", up: true, flat: true };
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

function analysisTitle(period: AdminDashboardPeriod): string {
  if (period === "week") return "Analyse de la semaine";
  if (period === "month") return "Analyse du mois";
  return "Analyse du jour";
}

function emptySalesMessage(period: AdminDashboardPeriod): string {
  if (period === "week") return "Aucune vente cette semaine.";
  if (period === "month") return "Aucune vente ce mois.";
  return "Aucune vente pour l’instant.";
}

export function AdminDashboardWorkspace({
  data,
  serviceScope = "BOTH",
  activityCode = null,
}: AdminDashboardWorkspaceProps) {
  const router = useRouter();
  const profile = getActivityProfile(activityCode);
  const retail = profile.kind === "retail";
  const hardware = isRetailShopOps(activityCode);
  const { kpis, salesByDept, salesSeries, analysisPeriod } =
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

  const pageTitle = hardware ? "Accueil" : "Tableau de bord";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden px-3 py-2 lg:gap-3 lg:px-6 lg:py-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-[20px] font-bold leading-none tracking-tight text-slate-900 lg:text-[22px]">
          {pageTitle}
        </h1>
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
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 active:bg-slate-50 sm:hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {hardware ? (
            <InstantLink
              href="/application/caisse"
              className="inline-flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm active:bg-emerald-700 sm:h-8 sm:min-h-8 sm:text-[12px]"
            >
              <ShoppingBag className="h-4 w-4" />
              Vendre
            </InstantLink>
          ) : null}
        </div>
      </header>

      {retail ? (
        <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 lg:mx-0 lg:px-0">
          <QuickLink href="/application/produits" icon={<Package className="h-4 w-4" />} label="Produits" />
          <QuickLink href="/application/stock" icon={<Store className="h-4 w-4" />} label="Stock" />
          <QuickLink href="/application/ventes" icon={<ClipboardList className="h-4 w-4" />} label="Ventes" />
        </div>
      ) : null}

      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 lg:hidden">
        <MobileKpi
          accent="border-l-emerald-500"
          label={retail ? "CA" : "Ventes"}
          value={formatPriceXof(kpis.salesToday)}
          sub={<TrendBadge trend={salesTrend} />}
        />
        <MobileKpi
          accent="border-l-sky-500"
          label={retail ? "Dépenses" : "Commandes"}
          value={retail ? formatPriceXof(kpis.expensesToday) : String(kpis.ordersToday)}
          sub={
            retail ? (
              <span className="font-medium text-slate-500">Du jour</span>
            ) : (
              <TrendBadge trend={ordersTrend} />
            )
          }
        />
        <MobileKpi
          accent="border-l-teal-500"
          label={retail ? "Bénéfice" : "Caisses"}
          value={
            retail
              ? kpis.profitAvailable && kpis.profitToday !== null
                ? formatPriceXof(kpis.profitToday)
                : "—"
              : formatPriceXof(kpis.openCashBalance ?? 0)
          }
          sub={
            <span className="text-slate-400">
              {retail
                ? kpis.profitAvailable
                  ? "Ventes − coût vendu − dépenses"
                  : "Après le 1er approvisionnement"
                : `${openSessionsCount} ouverte${openSessionsCount > 1 ? "s" : ""}`}
            </span>
          }
        />
        <MobileKpi
          accent={kpis.stockAlertCount > 0 ? "border-l-orange-500" : "border-l-slate-300"}
          label="Alertes"
          value={String(kpis.stockAlertCount)}
          sub={
            <InstantLink href="/application/stock" className="font-medium text-emerald-700">
              Voir le stock
            </InstantLink>
          }
        />
      </div>

      <div className="hidden shrink-0 grid-cols-4 gap-3 lg:grid">
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
          icon={retail ? <Wallet className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
          iconClass="bg-teal-50 text-teal-700"
          label={retail ? "Bénéfice du jour" : "Solde caisses"}
          value={
            retail
              ? kpis.profitAvailable && kpis.profitToday !== null
                ? formatPriceXof(kpis.profitToday)
                : "—"
              : formatPriceXof(kpis.openCashBalance ?? 0)
          }
          sub={
            retail ? (
              <span className="text-slate-500">
                {kpis.profitAvailable
                  ? "Ventes − coût vendu − dépenses"
                  : "Après le 1er approvisionnement"}
              </span>
            ) : openSessionsCount > 0 ? (
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
            <InstantLink
              href="/application/stock"
              className="font-medium text-slate-600 hover:text-emerald-700 hover:underline"
            >
              {kpis.stockAlertCount > 0 ? "Traiter les ruptures" : "Stock à jour"}
            </InstantLink>
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pb-1 lg:grid-cols-12 lg:gap-4 lg:overflow-hidden">
        <Panel
          className="min-h-0 lg:col-span-5"
          title={profile.topProductsTitle}
        >
          {topProducts.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-5 w-5" />}
              message={emptySalesMessage(analysisPeriod)}
              hint="Les meilleurs articles s’afficheront ici."
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
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
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-[11px] font-bold text-emerald-700">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold text-slate-900">
                              {product.name}
                            </p>
                            <p className="shrink-0 text-[12px] font-bold tabular-nums text-emerald-700">
                              {formatPriceXof(product.revenue)}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {product.quantity} unité{product.quantity > 1 ? "s" : ""}
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
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
        >
          {retail && !hasSeriesSales && kpis.salesToday === 0 && kpis.ordersToday === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-5 w-5" />}
              message={emptySalesMessage(analysisPeriod)}
              hint="L’analyse se remplit dès les premières ventes."
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-hidden p-4">
              {retail ? (
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="Ventes" value={String(kpis.ordersToday)} />
                  <MiniStat label="CA" value={formatPriceXof(kpis.salesToday)} />
                  <MiniStat label="Dépenses" value={formatPriceXof(kpis.expensesToday)} />
                  <MiniStat
                    label="Bénéfice"
                    value={
                      kpis.profitAvailable && kpis.profitToday !== null
                        ? formatPriceXof(kpis.profitToday)
                        : "—"
                    }
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {hasBarService(serviceScope) ? (
                    <DeptBar
                      icon={<Wine className="h-3.5 w-3.5" />}
                      label="Bar"
                      amount={salesByDept.bar}
                      total={deptTotal}
                      tone="bg-emerald-500"
                    />
                  ) : null}
                  {hasKitchenService(serviceScope) ? (
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
                    <p className="text-[12px] text-slate-400">
                      {emptySalesMessage(analysisPeriod)}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel
          className="min-h-0 lg:col-span-4"
          title="Activité récente"
        >
          {activity.length === 0 ? (
            <EmptyState
              icon={<CircleDollarSign className="h-5 w-5" />}
              message="Aucune activité"
              hint="Les ventes et mouvements s’afficheront ici."
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="space-y-0.5 px-1.5 py-1.5">
                {activity.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-2.5 rounded-lg px-1.5 py-2 hover:bg-slate-50/90"
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
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="shrink-0 text-[10px] tabular-nums text-slate-400">
                          {relativeTime(item.at)}
                        </p>
                      </div>
                      <p className="truncate text-[12px] text-slate-500">{item.detail}</p>
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
      className="inline-flex h-11 min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 shadow-sm active:bg-slate-50 lg:h-10 lg:min-h-10"
    >
      <span className="text-emerald-700">{icon}</span>
      {label}
    </InstantLink>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-slate-900">
        {value}
      </p>
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

function MobileKpi({
  accent,
  label,
  value,
  sub,
}: {
  accent: string;
  label: string;
  value: string;
  sub: ReactNode;
}) {
  return (
    <div
      className={`w-[44%] min-w-[10rem] shrink-0 rounded-2xl border border-l-4 border-slate-200/90 bg-white px-3 py-3 shadow-sm ${accent}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-[16px] font-bold tabular-nums text-slate-900">
        {value}
      </p>
      <div className="mt-0.5 text-[10px]">{sub}</div>
    </div>
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
      className={`rounded-2xl border border-slate-200/90 border-l-4 bg-white px-3 py-2.5 shadow-sm ${accent}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="truncate text-[17px] font-bold tracking-tight tabular-nums text-slate-900">
            {value}
          </p>
          <div className="mt-0.5 text-[11px]">{sub}</div>
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
      className={`flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm lg:h-full lg:min-h-0 ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  );
}

function EmptyState({
  message,
  hint,
  icon,
}: {
  message: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-6 text-center">
      {icon ? (
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
          {icon}
        </span>
      ) : null}
      <p className="mt-3 text-[13px] font-semibold text-slate-700">{message}</p>
      {hint ? (
        <p className="mt-1 max-w-[14rem] text-[12px] leading-snug text-slate-400">{hint}</p>
      ) : null}
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
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
          {icon}
          {label}
        </span>
        <span className="tabular-nums text-slate-500">
          {pct}% · {formatPriceXof(amount)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
