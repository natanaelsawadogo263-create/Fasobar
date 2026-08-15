import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  mapClosingSummary,
} from "@/lib/bar/session-queries";
import type { BarSessionClosingSummary } from "@/lib/bar/session-types";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type AdminBarSessionListItem = {
  id: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  managerName: string;
  openedAt: string;
  closedAt: string | null;
  ordersServedCount: number;
  drinksOutQty: number;
  stockEntriesCount: number;
  stockLossesCount: number;
};

export type AdminBarSessionsPageData = {
  sessions: AdminBarSessionListItem[];
  openCount: number;
  closedCount: number;
};

export type AdminBarSessionDetail = AdminBarSessionListItem & {
  openingNote: string | null;
  closingNote: string | null;
  closedByName: string | null;
  summary: BarSessionClosingSummary | null;
};

type BarSessionListRow = {
  id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  orders_ready_count: number | null;
  closing_orders_served_count?: number | null;
  closing_drinks_out_qty?: number | null;
  closing_stock_entries_count: number | null;
  closing_stock_losses_count: number | null;
  closing_summary?: unknown;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export async function listAdminBarSessions(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string } = {},
): Promise<AdminBarSessionsPageData> {
  const supabase = await createClient();

  let query = supabase
    .from("bar_sessions")
    .select(
      `
      id,
      status,
      opened_at,
      closed_at,
      orders_ready_count,
      closing_orders_served_count,
      closing_drinks_out_qty,
      closing_stock_entries_count,
      closing_stock_losses_count,
      closing_summary,
      profiles!bar_sessions_opened_by_fkey(full_name)
    `,
    )
    .eq("establishment_id", workspace.establishmentId)
    .order("opened_at", { ascending: false })
    .limit(80);

  if (options.from) {
    query = query.gte("opened_at", `${options.from}T00:00:00.000Z`);
  }
  if (options.to) {
    query = query.lte("opened_at", `${options.to}T23:59:59.999Z`);
  }

  const [{ data, error }, openOutside] = await Promise.all([
    query,
    options.from || options.to
      ? supabase
          .from("bar_sessions")
          .select(
            `
      id,
      status,
      opened_at,
      closed_at,
      orders_ready_count,
      closing_orders_served_count,
      closing_drinks_out_qty,
      closing_stock_entries_count,
      closing_stock_losses_count,
      closing_summary,
      profiles!bar_sessions_opened_by_fkey(full_name)
    `,
          )
          .eq("establishment_id", workspace.establishmentId)
          .eq("status", "OPEN")
          .order("opened_at", { ascending: false })
      : Promise.resolve({ data: [] as BarSessionListRow[], error: null }),
  ]);

  if (error || !data) {
    // Colonnes nouvelles absentes : requête legacy
    if (error?.message?.includes("closing_")) {
      return listAdminBarSessionsLegacy(workspace, options);
    }
    console.error("[listAdminBarSessions]", error?.message);
    return { sessions: [], openCount: 0, closedCount: 0 };
  }

  const byId = new Map<string, BarSessionListRow>();
  for (const row of [...(openOutside.data ?? []), ...(data as BarSessionListRow[])]) {
    byId.set(row.id, row);
  }
  const merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
  );

  const sessions: AdminBarSessionListItem[] = merged.map((row) => {
    const profile = readSingle(row.profiles);
    const summary = mapClosingSummary(row.closing_summary);

    return {
      id: row.id,
      status: row.status as AdminBarSessionListItem["status"],
      managerName: profile?.full_name ?? "—",
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      ordersServedCount: Number(
        row.closing_orders_served_count ?? row.orders_ready_count ?? 0,
      ),
      drinksOutQty: Number(
        row.closing_drinks_out_qty ?? summary?.drinksOutQty ?? 0,
      ),
      stockEntriesCount: Number(row.closing_stock_entries_count ?? 0),
      stockLossesCount: Number(row.closing_stock_losses_count ?? 0),
    };
  });

  return {
    sessions,
    openCount: sessions.filter((s) => s.status === "OPEN").length,
    closedCount: sessions.filter((s) => s.status === "CLOSED").length,
  };
}

async function listAdminBarSessionsLegacy(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string } = {},
): Promise<AdminBarSessionsPageData> {
  const supabase = await createClient();
  let query = supabase
    .from("bar_sessions")
    .select(
      `
      id,
      status,
      opened_at,
      closed_at,
      orders_ready_count,
      closing_stock_entries_count,
      closing_stock_losses_count,
      profiles!bar_sessions_opened_by_fkey(full_name)
    `,
    )
    .eq("establishment_id", workspace.establishmentId)
    .order("opened_at", { ascending: false })
    .limit(80);

  if (options.from) {
    query = query.gte("opened_at", `${options.from}T00:00:00.000Z`);
  }
  if (options.to) {
    query = query.lte("opened_at", `${options.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { sessions: [], openCount: 0, closedCount: 0 };
  }

  const sessions: AdminBarSessionListItem[] = data.map((row) => {
    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );
    return {
      id: row.id as string,
      status: row.status as AdminBarSessionListItem["status"],
      managerName: profile?.full_name ?? "—",
      openedAt: row.opened_at as string,
      closedAt: (row.closed_at as string | null) ?? null,
      ordersServedCount: Number(row.orders_ready_count ?? 0),
      drinksOutQty: 0,
      stockEntriesCount: Number(row.closing_stock_entries_count ?? 0),
      stockLossesCount: Number(row.closing_stock_losses_count ?? 0),
    };
  });

  return {
    sessions,
    openCount: sessions.filter((s) => s.status === "OPEN").length,
    closedCount: sessions.filter((s) => s.status === "CLOSED").length,
  };
}

export async function getAdminBarSessionDetail(
  workspace: WorkspaceContext,
  sessionId: string,
): Promise<AdminBarSessionDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bar_sessions")
    .select(
      `
      id,
      status,
      opened_at,
      closed_at,
      opening_note,
      closing_note,
      orders_ready_count,
      closing_orders_served_count,
      closing_drinks_out_qty,
      closing_stock_entries_count,
      closing_stock_losses_count,
      closing_summary,
      profiles!bar_sessions_opened_by_fkey(full_name),
      closed_by_profile:profiles!bar_sessions_closed_by_fkey(full_name)
    `,
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    console.error("[getAdminBarSessionDetail]", error?.message);
    return null;
  }

  const openedBy = readSingle(
    data.profiles as { full_name: string } | { full_name: string }[] | null,
  );
  const closedBy = readSingle(
    data.closed_by_profile as
      | { full_name: string }
      | { full_name: string }[]
      | null,
  );

  let summary = mapClosingSummary(data.closing_summary);
  if (!summary && data.status === "OPEN") {
    const { data: preview } = await supabase.rpc("get_bar_session_closing_summary", {
      p_session_id: sessionId,
    });
    summary = mapClosingSummary(preview);
  }

  return {
    id: data.id as string,
    status: data.status as AdminBarSessionListItem["status"],
    managerName: openedBy?.full_name ?? "—",
    openedAt: data.opened_at as string,
    closedAt: (data.closed_at as string | null) ?? null,
    ordersServedCount: Number(
      data.closing_orders_served_count ?? data.orders_ready_count ?? 0,
    ),
    drinksOutQty: Number(
      data.closing_drinks_out_qty ?? summary?.drinksOutQty ?? 0,
    ),
    stockEntriesCount: Number(data.closing_stock_entries_count ?? 0),
    stockLossesCount: Number(data.closing_stock_losses_count ?? 0),
    openingNote: (data.opening_note as string | null) ?? null,
    closingNote: (data.closing_note as string | null) ?? null,
    closedByName: closedBy?.full_name ?? null,
    summary,
  };
}
