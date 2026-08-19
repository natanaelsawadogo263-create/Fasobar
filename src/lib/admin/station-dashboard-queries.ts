import "server-only";

import { cache } from "react";

import type { AdminPumpSessionListItem } from "@/lib/admin/station-sessions-queries";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { createClient } from "@/lib/supabase/server";

export type StationDashboardPeriod = "day" | "week" | "month";

export type StationDashboardData = {
  kpis: {
    revenue: number;
    revenuePrevious: number;
    liters: number;
    litersPrevious: number;
    closedCount: number;
    openCount: number;
  };
  openSessions: AdminPumpSessionListItem[];
  recentClosed: AdminPumpSessionListItem[];
  period: StationDashboardPeriod;
  periodLabel: string;
  establishmentName: string;
};

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapSessionRow(row: Record<string, unknown>): AdminPumpSessionListItem {
  const fuelPump = readSingle(
    row.fuel_pumps as { name: string } | { name: string }[] | null,
  );
  const fuelType = readSingle(
    row.fuel_types as { name: string } | { name: string }[] | null,
  );
  const profile = readSingle(
    row.profiles as { full_name: string } | { full_name: string }[] | null,
  );

  return {
    id: String(row.id),
    status: row.status === "OPEN" ? "OPEN" : "CLOSED",
    openedAt: String(row.opened_at),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    fuelPumpName: fuelPump?.name ?? "—",
    fuelTypeName: fuelType?.name ?? "—",
    openedByName: profile?.full_name ?? null,
    indexStart: Number(row.index_start ?? 0),
    indexEnd: row.index_end == null ? null : Number(row.index_end),
    litersSold: row.liters_sold == null ? null : Number(row.liters_sold),
    totalCollected:
      row.total_collected == null ? null : Number(row.total_collected),
  };
}

const SESSION_SELECT =
  "id, status, opened_at, closed_at, index_start, index_end, liters_sold, total_collected, fuel_pumps(name), fuel_types(name), profiles!pump_sessions_opened_by_fkey(full_name)";

function aggregateClosed(sessions: AdminPumpSessionListItem[]) {
  return {
    revenue: sessions.reduce((sum, row) => sum + (row.totalCollected ?? 0), 0),
    liters: sessions.reduce((sum, row) => sum + (row.litersSold ?? 0), 0),
    count: sessions.length,
  };
}

function previousPeriodRange(
  period: StationDashboardPeriod,
  anchor = toLocalIsoDate(new Date()),
): { from: string; to: string } {
  const anchorDate = new Date(`${anchor}T12:00:00`);
  if (period === "day") {
    anchorDate.setDate(anchorDate.getDate() - 1);
    const day = toLocalIsoDate(anchorDate);
    return { from: day, to: day };
  }
  if (period === "week") {
    anchorDate.setDate(anchorDate.getDate() - 7);
    const weekAnchor = toLocalIsoDate(anchorDate);
    const range = resolveOrderPeriodRange("week", weekAnchor);
    return { from: range.from ?? weekAnchor, to: range.to ?? weekAnchor };
  }
  anchorDate.setMonth(anchorDate.getMonth() - 1);
  const monthAnchor = toLocalIsoDate(anchorDate);
  const range = resolveOrderPeriodRange("month", monthAnchor);
  return { from: range.from ?? monthAnchor, to: range.to ?? monthAnchor };
}

async function listClosedSessionsInRange(
  workspace: WorkspaceContext,
  from: string,
  to: string,
  limit = 120,
): Promise<AdminPumpSessionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pump_sessions")
    .select(SESSION_SELECT)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("status", "CLOSED")
    .gte("closed_at", `${from}T00:00:00`)
    .lte("closed_at", `${to}T23:59:59.999`)
    .order("closed_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("[listClosedSessionsInRange]", error.message);
    return [];
  }

  return data.map((row) => mapSessionRow(row as Record<string, unknown>));
}

async function listOpenSessions(
  workspace: WorkspaceContext,
): Promise<AdminPumpSessionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pump_sessions")
    .select(SESSION_SELECT)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("status", "OPEN")
    .order("opened_at", { ascending: false })
    .limit(12);

  if (error || !data) {
    if (error) console.error("[listOpenSessions]", error.message);
    return [];
  }

  return data.map((row) => mapSessionRow(row as Record<string, unknown>));
}

export const getStationDashboardData = cache(async function getStationDashboardData(
  workspace: WorkspaceContext,
  options: { period?: StationDashboardPeriod } = {},
): Promise<StationDashboardData> {
  const period = options.period ?? "day";
  const anchor = toLocalIsoDate(new Date());
  const range = resolveOrderPeriodRange(period, anchor);
  const previous = previousPeriodRange(period, anchor);
  const from = range.from ?? anchor;
  const to = range.to ?? anchor;

  const [openSessions, currentClosed, previousClosed] = await Promise.all([
    listOpenSessions(workspace),
    listClosedSessionsInRange(workspace, from, to),
    listClosedSessionsInRange(workspace, previous.from, previous.to),
  ]);

  const current = aggregateClosed(currentClosed);
  const prev = aggregateClosed(previousClosed);

  return {
    kpis: {
      revenue: current.revenue,
      revenuePrevious: prev.revenue,
      liters: current.liters,
      litersPrevious: prev.liters,
      closedCount: current.count,
      openCount: openSessions.length,
    },
    openSessions,
    recentClosed: currentClosed.slice(0, 8),
    period,
    periodLabel: formatOrderPeriodLabel(period, from, to),
    establishmentName: workspace.establishmentName,
  };
});
