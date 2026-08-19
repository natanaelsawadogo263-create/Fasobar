import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  formatOrderPeriodLabel,
  parseLocalIsoDate,
  resolveOrderPeriodRange,
  startOfWeekMonday,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { getCashierServiceDayStartIso } from "@/lib/orders/queries";
import { sumSoldGoodsCost } from "@/lib/profit/cost-of-goods";
import { hasEstablishmentSupplyHistory } from "@/lib/profit/supply-history";
import { listDashboardStockAlerts } from "@/lib/stock/queries";
import type { StockListItem } from "@/lib/stock/types";
import { createClient } from "@/lib/supabase/server";

export type AdminDashboardKpis = {
  salesToday: number;
  salesYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  openCashBalance: number | null;
  openCashOpenedAt: string | null;
  stockAlertCount: number;
  expensesToday: number;
  profitToday: number | null;
  profitAvailable: boolean;
};

export type AdminTopProduct = {
  name: string;
  quantity: number;
  revenue: number;
  imageHint: string;
};

export type AdminActivityItem = {
  id: string;
  title: string;
  detail: string;
  at: string;
  kind: "payment" | "stock" | "order" | "session";
};

export type AdminCashSessionRow = {
  id: string;
  label: string;
  cashierName: string;
  openedAt: string;
  status: "OPEN" | "CLOSED";
  balance: number;
};

export type AdminLiveOps = {
  openOrdersCount: number;
  readyToPayCount: number;
  barToPrepareCount: number;
  barInPrepCount: number;
  barReadyCount: number;
  kitchenToPrepareCount: number;
  kitchenReadyCount: number;
  openCashSessionsCount: number;
  openBarSession: { openedByName: string; openedAt: string } | null;
};

export type AdminDashboardPeriod = "day" | "week" | "month";

export type AdminSalesSeries = {
  values: number[];
  labels: string[];
  granularity: "hour" | "day";
};

export type AdminDashboardData = {
  kpis: AdminDashboardKpis;
  liveOps: AdminLiveOps;
  stockAlerts: StockListItem[];
  topProducts: AdminTopProduct[];
  activity: AdminActivityItem[];
  cashSessions: AdminCashSessionRow[];
  salesByHour: number[];
  salesSeries: AdminSalesSeries;
  salesByDept: { bar: number; kitchen: number; other: number };
  analysisPeriod: AdminDashboardPeriod;
  analysisPeriodLabel: string;
  usedMockSalesSeries: boolean;
  usedMockTopProducts: boolean;
};

type PaidOrderRow = {
  id: string;
  total_amount: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function startOfDayIso(reference = new Date()): string {
  return getCashierServiceDayStartIso(reference.toISOString());
}

function addDaysIso(dayStartIso: string, days: number): string {
  const date = new Date(dayStartIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function periodBoundsIso(period: AdminDashboardPeriod): {
  fromIso: string;
  toExclusiveIso: string;
  fromDate: string;
  toDate: string;
} {
  const range = resolveOrderPeriodRange(period);
  const fromDate = range.from ?? toLocalIsoDate(new Date());
  const toDate = range.to ?? fromDate;
  const from = parseLocalIsoDate(fromDate);
  const toExclusive = parseLocalIsoDate(toDate);
  toExclusive.setDate(toExclusive.getDate() + 1);

  return {
    fromIso: new Date(
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()),
    ).toISOString(),
    toExclusiveIso: new Date(
      Date.UTC(
        toExclusive.getFullYear(),
        toExclusive.getMonth(),
        toExclusive.getDate(),
      ),
    ).toISOString(),
    fromDate,
    toDate,
  };
}

function buildSalesSeries(
  period: AdminDashboardPeriod,
  paidOrders: PaidOrderRow[],
  fromDate: string,
  toDate: string,
): AdminSalesSeries {
  if (period === "day") {
    const values = Array.from({ length: 24 }, () => 0);
    for (const order of paidOrders) {
      const stamp = order.updated_at ?? order.created_at;
      if (!stamp) continue;
      values[new Date(stamp).getUTCHours()] += order.total_amount ?? 0;
    }
    return {
      values,
      labels: values.map((_, hour) => `${hour}h`),
      granularity: "hour",
    };
  }

  if (period === "week") {
    const values = Array.from({ length: 7 }, () => 0);
    const labels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const weekStart = startOfWeekMonday(parseLocalIsoDate(fromDate));
    for (const order of paidOrders) {
      const stamp = order.updated_at ?? order.created_at;
      if (!stamp) continue;
      const d = new Date(stamp);
      const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const diff = Math.floor(
        (local.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (diff >= 0 && diff < 7) values[diff] += order.total_amount ?? 0;
    }
    return { values, labels, granularity: "day" };
  }

  const start = parseLocalIsoDate(fromDate);
  const end = parseLocalIsoDate(toDate);
  const dayCount = end.getDate();
  const values = Array.from({ length: dayCount }, () => 0);
  const labels = values.map((_, i) => String(i + 1));
  for (const order of paidOrders) {
    const stamp = order.updated_at ?? order.created_at;
    if (!stamp) continue;
    const d = new Date(stamp);
    const day = d.getUTCDate();
    if (
      d.getUTCFullYear() === start.getFullYear() &&
      d.getUTCMonth() === start.getMonth() &&
      day >= 1 &&
      day <= dayCount
    ) {
      values[day - 1] += order.total_amount ?? 0;
    }
  }
  return { values, labels, granularity: "day" };
}

function readSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getAdminDashboardData(
  workspace: WorkspaceContext,
  options: { period?: AdminDashboardPeriod } = {},
): Promise<AdminDashboardData> {
  const period: AdminDashboardPeriod = options.period ?? "day";
  const supabase = await createClient();
  const todayStart = startOfDayIso();
  const tomorrowStart = addDaysIso(todayStart, 1);
  const yesterdayStart = addDaysIso(todayStart, -1);
  const bounds = periodBoundsIso(period);
  const analysisPeriodLabel = formatOrderPeriodLabel(
    period,
    bounds.fromDate,
    bounds.toDate,
  );

  const [
    stockAlertsResult,
    todayPaidOrders,
    yesterdayPaidOrders,
    periodPaidOrders,
    openSessions,
    closedSessionsToday,
    recentPayments,
    recentMovements,
    openCashPayments,
    liveOpenOrders,
    openBarSessionRow,
    todayExpenses,
    profitAvailable,
  ] = await Promise.all([
    listDashboardStockAlerts(workspace, 5),
    supabase
      .from("orders")
      .select("id, total_amount, created_at, updated_at")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("payment_status", "PAID")
      .gte("updated_at", todayStart)
      .lt("updated_at", tomorrowStart),
    supabase
      .from("orders")
      .select("id, total_amount")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("payment_status", "PAID")
      .gte("updated_at", yesterdayStart)
      .lt("updated_at", todayStart),
    period === "day"
      ? Promise.resolve({ data: null as PaidOrderRow[] | null })
      : supabase
          .from("orders")
          .select("id, total_amount, created_at, updated_at")
          .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
          .eq("payment_status", "PAID")
          .gte("updated_at", bounds.fromIso)
          .lt("updated_at", bounds.toExclusiveIso),
    supabase
      .from("cash_register_sessions")
      .select(
        "id, status, opening_cash_amount, expected_cash_amount, opened_at, closed_at, profiles!cash_register_sessions_opened_by_fkey(full_name)",
      )
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: false })
      .limit(10),
    supabase
      .from("cash_register_sessions")
      .select(
        "id, status, opening_cash_amount, expected_cash_amount, counted_cash_amount, opened_at, closed_at, profiles!cash_register_sessions_opened_by_fkey(full_name)",
      )
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("status", "CLOSED")
      .gte("opened_at", todayStart)
      .order("opened_at", { ascending: false })
      .limit(5),
    supabase
      .from("payments")
      .select("id, amount_applied, received_at, method, status")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("status", "CONFIRMED")
      .order("received_at", { ascending: false })
      .limit(8),
    supabase
      .from("stock_movements")
      .select("id, type, quantity, created_at, stock_items(name)")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("payments")
      .select("amount_applied, cash_register_session_id, cash_register_sessions!inner(status)")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("status", "CONFIRMED")
      .eq("cash_register_sessions.status", "OPEN")
      .limit(400),
    supabase
      .from("orders")
      .select("id, status, payment_status, bar_status, kitchen_status")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .neq("payment_status", "PAID")
      .neq("status", "CANCELLED")
      .in("status", ["OPEN", "READY_TO_PAY", "DRAFT"])
      .limit(300),
    supabase
      .from("bar_sessions")
      .select(
        "id, opened_at, profiles!bar_sessions_opened_by_fkey(full_name)",
      )
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("expenses")
      .select("amount, status")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("status", "RECORDED")
      .eq("expense_date", toLocalIsoDate(new Date())),
    hasEstablishmentSupplyHistory(workspace),
  ]);

  const stockItems = stockAlertsResult.alerts;
  const paidToday = (todayPaidOrders.data ?? []) as PaidOrderRow[];
  const paidYesterday = yesterdayPaidOrders.data ?? [];
  const paidForAnalysis =
    period === "day" ? paidToday : ((periodPaidOrders.data ?? []) as PaidOrderRow[]);

  const salesToday = paidToday.reduce((sum, row) => sum + (row.total_amount ?? 0), 0);
  const salesYesterday = paidYesterday.reduce(
    (sum, row) => sum + (row.total_amount ?? 0),
    0,
  );
  const expensesToday = (todayExpenses.data ?? []).reduce(
    (sum, row) => sum + (row.amount ?? 0),
    0,
  );
  const purchaseCostToday = profitAvailable
    ? await sumSoldGoodsCost(
        workspace.establishmentId,
        paidToday.map((row) => row.id),
      )
    : 0;
  const profitToday = profitAvailable
    ? salesToday - purchaseCostToday - expensesToday
    : null;

  const openSessionRows = openSessions.data ?? [];
  const firstOpen = openSessionRows[0];
  const openCashCollected =
    openCashPayments.data?.reduce((sum, row) => sum + (row.amount_applied ?? 0), 0) ?? 0;
  const openCashBalance =
    openSessionRows.length > 0
      ? openCashCollected +
        openSessionRows.reduce((sum, row) => sum + (row.opening_cash_amount ?? 0), 0)
      : null;
  const openCashOpenedAt = firstOpen?.opened_at ?? null;

  const salesSeries = buildSalesSeries(
    period,
    paidForAnalysis,
    bounds.fromDate,
    bounds.toDate,
  );

  const orderIds = paidForAnalysis.map((order) => order.id);
  let topProducts: AdminTopProduct[] = [];
  const salesByDept = { bar: 0, kitchen: 0, other: 0 };

  if (orderIds.length > 0) {
    const sampleOrderIds = orderIds.slice(0, 120);
    const { data: itemRows } = await supabase
      .from("order_items")
      .select("product_name_snapshot, quantity, line_total, departments(code)")
      .in("order_id", sampleOrderIds);

    const productMap = new Map<string, { quantity: number; revenue: number }>();

    for (const row of itemRows ?? []) {
      const department = readSingle(
        row.departments as { code: string } | { code: string }[] | null,
      );
      const code = department?.code;
      if (code === "BAR") salesByDept.bar += row.line_total ?? 0;
      else if (code === "KITCHEN") salesByDept.kitchen += row.line_total ?? 0;
      else salesByDept.other += row.line_total ?? 0;

      const name = row.product_name_snapshot ?? "Produit";
      const current = productMap.get(name) ?? { quantity: 0, revenue: 0 };
      current.quantity += Number(row.quantity ?? 0);
      current.revenue += row.line_total ?? 0;
      productMap.set(name, current);
    }

    topProducts = Array.from(productMap.entries())
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        revenue: stats.revenue,
        imageHint: name.toLowerCase(),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 12);
  }

  function readProfile(
    value: { full_name: string } | { full_name: string }[] | null | undefined,
  ): string {
    if (!value) return "—";
    if (Array.isArray(value)) return value[0]?.full_name ?? "—";
    return value.full_name;
  }

  const cashSessions: AdminCashSessionRow[] = [
    ...openSessionRows.map((row, index) => ({
      id: row.id,
      label: `Caisse ${index + 1}`,
      cashierName: readProfile(
        row.profiles as { full_name: string } | { full_name: string }[] | null,
      ),
      openedAt: row.opened_at,
      status: "OPEN" as const,
      balance: row.expected_cash_amount ?? row.opening_cash_amount ?? 0,
    })),
    ...(closedSessionsToday.data ?? []).map((row, index) => ({
      id: row.id,
      label: `Caisse ${openSessionRows.length + index + 1}`,
      cashierName: readProfile(
        row.profiles as { full_name: string } | { full_name: string }[] | null,
      ),
      openedAt: row.opened_at,
      status: "CLOSED" as const,
      balance:
        row.counted_cash_amount ?? row.expected_cash_amount ?? row.opening_cash_amount ?? 0,
    })),
  ].slice(0, 5);

  const activity: AdminActivityItem[] = [];

  for (const payment of recentPayments.data ?? []) {
    activity.push({
      id: `pay-${payment.id}`,
      title: "Encaissement",
      detail: `${payment.amount_applied?.toLocaleString("fr-FR")} FCFA · ${payment.method}`,
      at: payment.received_at,
      kind: "payment",
    });
  }

  for (const movement of recentMovements.data ?? []) {
    const item = movement.stock_items as
      | { name: string }
      | { name: string }[]
      | null;
    const name = Array.isArray(item) ? item[0]?.name : item?.name;
    activity.push({
      id: `mov-${movement.id}`,
      title: movement.type === "PURCHASE" ? "Entrée stock" : "Mouvement stock",
      detail: `${name ?? "Article"} · ${movement.quantity}`,
      at: movement.created_at,
      kind: "stock",
    });
  }

  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const openLive = liveOpenOrders.data ?? [];
  const barSessionProfile = readSingle(
    openBarSessionRow.data?.profiles as
      | { full_name: string }
      | { full_name: string }[]
      | null
      | undefined,
  );

  const liveOps: AdminLiveOps = {
    openOrdersCount: openLive.length,
    readyToPayCount: openLive.filter((order) => order.status === "READY_TO_PAY").length,
    barToPrepareCount: openLive.filter((order) => order.bar_status === "TO_PREPARE").length,
    barInPrepCount: openLive.filter((order) => order.bar_status === "IN_PREPARATION").length,
    barReadyCount: openLive.filter((order) => order.bar_status === "READY").length,
    kitchenToPrepareCount: openLive.filter(
      (order) =>
        order.kitchen_status === "TO_PREPARE" || order.kitchen_status === "IN_PREPARATION",
    ).length,
    kitchenReadyCount: openLive.filter((order) => order.kitchen_status === "READY").length,
    openCashSessionsCount: openSessionRows.length,
    openBarSession: openBarSessionRow.data
      ? {
          openedByName: barSessionProfile?.full_name ?? "Responsable bar",
          openedAt: openBarSessionRow.data.opened_at,
        }
      : null,
  };

  return {
    kpis: {
      salesToday,
      salesYesterday,
      ordersToday: paidToday.length,
      ordersYesterday: paidYesterday.length,
      openCashBalance,
      openCashOpenedAt,
      stockAlertCount: stockAlertsResult.alertCount,
      expensesToday,
      profitToday,
      profitAvailable,
    },
    liveOps,
    stockAlerts: stockItems,
    topProducts,
    activity: activity.slice(0, 12),
    cashSessions,
    salesByHour: salesSeries.values,
    salesSeries,
    salesByDept,
    analysisPeriod: period,
    analysisPeriodLabel,
    usedMockSalesSeries: false,
    usedMockTopProducts: false,
  };
}
