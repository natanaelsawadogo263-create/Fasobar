import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type AdminPumpSessionListItem = {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  fuelPumpName: string;
  fuelTypeName: string;
  openedByName: string | null;
  indexStart: number;
  indexEnd: number | null;
  litersSold: number | null;
  totalCollected: number | null;
};

export type AdminPumpSessionsPageData = {
  sessions: AdminPumpSessionListItem[];
  openCount: number;
  closedCount: number;
};

type ListOptions = {
  from?: string;
  to?: string;
  limit?: number;
};

export const listAdminStationPumpSessions = cache(async function listAdminStationPumpSessions(
  workspace: WorkspaceContext,
  options: ListOptions = {},
): Promise<AdminPumpSessionsPageData> {
  const supabase = await createClient();
  const limit = options.limit ?? 80;

  let query = supabase
    .from("pump_sessions")
    .select(
      "id, status, opened_at, closed_at, index_start, index_end, liters_sold, total_collected, fuel_pumps(name), fuel_types(name), profiles!pump_sessions_opened_by_fkey(full_name)",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("opened_at", { ascending: false })
    .limit(limit);

  if (options.from) {
    query = query.gte("opened_at", `${options.from}T00:00:00`);
  }
  if (options.to) {
    query = query.lte("opened_at", `${options.to}T23:59:59.999`);
  }

  const { data, error } = await query;

  if (error || !data) {
    if (error) console.error("[listAdminStationPumpSessions]", error.message);
    return { sessions: [], openCount: 0, closedCount: 0 };
  }

  const sessions: AdminPumpSessionListItem[] = data.map((row) => {
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
  });

  return {
    sessions,
    openCount: sessions.filter((s) => s.status === "OPEN").length,
    closedCount: sessions.filter((s) => s.status === "CLOSED").length,
  };
});
