import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type {
  BarSessionClosingSummary,
  BarSessionDetail,
  BarSessionProductQty,
  BarSessionTheoreticalStockItem,
} from "@/lib/bar/session-types";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapProductRows(raw: unknown): BarSessionProductQty[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      productName: String(item.product_name ?? item.productName ?? "—"),
      quantity: Number(item.quantity ?? 0),
      unit: item.unit != null ? String(item.unit) : undefined,
      type: item.type != null ? String(item.type) : undefined,
    };
  });
}

function mapTheoreticalStock(raw: unknown): BarSessionTheoreticalStockItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      stockItemId: String(item.stock_item_id ?? item.stockItemId ?? ""),
      productName: String(item.product_name ?? item.productName ?? "—"),
      unit: String(item.unit ?? ""),
      quantity: Number(item.quantity ?? 0),
      minimumQuantity: Number(item.minimum_quantity ?? item.minimumQuantity ?? 0),
      isLow: Boolean(item.is_low ?? item.isLow),
    };
  });
}

export function mapClosingSummary(raw: unknown): BarSessionClosingSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;

  return {
    sessionId: String(s.session_id ?? s.sessionId ?? ""),
    openedAt: String(s.opened_at ?? s.openedAt ?? ""),
    closedAt: String(s.closed_at ?? s.closedAt ?? ""),
    openedBy: s.opened_by != null ? String(s.opened_by) : s.openedBy != null ? String(s.openedBy) : null,
    closedBy: s.closed_by != null ? String(s.closed_by) : s.closedBy != null ? String(s.closedBy) : null,
    closingNote:
      s.closing_note != null
        ? String(s.closing_note)
        : s.closingNote != null
          ? String(s.closingNote)
          : null,
    ordersReceivedCount: Number(s.orders_received_count ?? s.ordersReceivedCount ?? 0),
    ordersServedCount: Number(s.orders_served_count ?? s.ordersServedCount ?? 0),
    ordersValidatedCount: Number(s.orders_validated_count ?? s.ordersValidatedCount ?? 0),
    ordersPendingCount: Number(s.orders_pending_count ?? s.ordersPendingCount ?? 0),
    drinksOutQty: Number(s.drinks_out_qty ?? s.drinksOutQty ?? 0),
    drinksByProduct: mapProductRows(s.drinks_by_product ?? s.drinksByProduct),
    stockEntriesCount: Number(s.stock_entries_count ?? s.stockEntriesCount ?? 0),
    stockEntriesCost: Number(s.stock_entries_cost ?? s.stockEntriesCost ?? 0),
    stockEntriesByProduct: mapProductRows(
      s.stock_entries_by_product ?? s.stockEntriesByProduct,
    ),
    stockLossesCount: Number(s.stock_losses_count ?? s.stockLossesCount ?? 0),
    stockLossesQty: Number(s.stock_losses_qty ?? s.stockLossesQty ?? 0),
    stockLossesByProduct: mapProductRows(
      s.stock_losses_by_product ?? s.stockLossesByProduct,
    ),
    stockCorrectionsCount: Number(
      s.stock_corrections_count ?? s.stockCorrectionsCount ?? 0,
    ),
    stockCorrectionsByProduct: mapProductRows(
      s.stock_corrections_by_product ?? s.stockCorrectionsByProduct,
    ),
    lowStockCount: Number(s.low_stock_count ?? s.lowStockCount ?? 0),
    theoreticalStock: mapTheoreticalStock(
      s.theoretical_stock ?? s.theoreticalStock,
    ),
  };
}

type SessionRow = {
  id: string;
  status: string;
  opening_note: string | null;
  closing_note: string | null;
  closing_summary: unknown;
  orders_ready_count: number;
  closing_orders_pending_count: number | null;
  closing_stock_entries_count: number | null;
  closing_stock_entries_cost: number | null;
  closing_stock_losses_count: number | null;
  closing_stock_losses_qty: number | string | null;
  closing_low_stock_count: number | null;
  opened_at: string;
  closed_at: string | null;
  opened_by: string;
  closed_by: string | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
  closed_by_profile?: { full_name: string } | { full_name: string }[] | null;
};

async function mapSessionDetail(
  workspace: WorkspaceContext,
  row: SessionRow,
): Promise<BarSessionDetail> {
  const profile = readSingle(row.profiles);
  const closedProfile = readSingle(row.closed_by_profile ?? null);
  const isOpen = row.status === "OPEN";
  const isOwnSession = row.opened_by === workspace.userId;

  let ordersPendingCount = row.closing_orders_pending_count ?? 0;
  let stockEntriesCount = row.closing_stock_entries_count ?? 0;
  let stockEntriesCost = row.closing_stock_entries_cost ?? 0;
  let stockLossesCount = row.closing_stock_losses_count ?? 0;
  let stockLossesQty = Number(row.closing_stock_losses_qty ?? 0);
  let lowStockCount = row.closing_low_stock_count ?? 0;
  let closingSummary = mapClosingSummary(row.closing_summary);

  if (isOpen) {
    const preview = await getBarSessionClosingSummary(row.id);
    if (preview) {
      closingSummary = preview;
      ordersPendingCount = preview.ordersPendingCount;
      stockEntriesCount = preview.stockEntriesCount;
      stockEntriesCost = preview.stockEntriesCost;
      stockLossesCount = preview.stockLossesCount;
      stockLossesQty = preview.stockLossesQty;
      lowStockCount = preview.lowStockCount;
    }
  }

  return {
    id: row.id,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingNote: row.opening_note,
    closingNote: row.closing_note,
    openedById: row.opened_by,
    openedByName: profile?.full_name ?? null,
    closedById: row.closed_by,
    closedByName: closedProfile?.full_name ?? null,
    isOwnSession,
    ordersReadyCount: row.orders_ready_count,
    ordersPendingCount,
    stockEntriesCount,
    stockEntriesCost,
    stockLossesCount,
    stockLossesQty,
    lowStockCount,
    closingOrdersPendingCount: row.closing_orders_pending_count,
    closingStockEntriesCount: row.closing_stock_entries_count,
    closingStockEntriesCost: row.closing_stock_entries_cost,
    closingStockLossesCount: row.closing_stock_losses_count,
    closingStockLossesQty:
      row.closing_stock_losses_qty == null
        ? null
        : Number(row.closing_stock_losses_qty),
    closingLowStockCount: row.closing_low_stock_count,
    closingSummary,
  };
}

const SESSION_SELECT = `
  id,
  status,
  opening_note,
  closing_note,
  closing_summary,
  orders_ready_count,
  closing_orders_pending_count,
  closing_stock_entries_count,
  closing_stock_entries_cost,
  closing_stock_losses_count,
  closing_stock_losses_qty,
  closing_low_stock_count,
  opened_at,
  closed_at,
  opened_by,
  closed_by,
  profiles!bar_sessions_opened_by_fkey(full_name),
  closed_by_profile:profiles!bar_sessions_closed_by_fkey(full_name)
`;

export async function getBarSessionClosingSummary(
  sessionId: string,
): Promise<BarSessionClosingSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_bar_session_closing_summary", {
    p_session_id: sessionId,
  });

  if (error) {
    // Migration pas encore appliquée : fallback silencieux
    if (
      /Could not find the function|PGRST202|schema cache|does not exist/i.test(
        error.message,
      )
    ) {
      return null;
    }
    console.error("[getBarSessionClosingSummary]", error.message);
    return null;
  }

  return mapClosingSummary(data);
}

export async function getOwnOpenBarSession(
  workspace: WorkspaceContext,
): Promise<BarSessionDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bar_sessions")
    .select(SESSION_SELECT)
    .eq("establishment_id", workspace.establishmentId)
    .eq("opened_by", workspace.userId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (error || !data) {
    // Fallback si colonnes closing_summary absentes
    if (error?.message?.includes("closing_summary")) {
      return getOwnOpenBarSessionLegacy(workspace);
    }
    return null;
  }

  return mapSessionDetail(workspace, data as SessionRow);
}

async function getOwnOpenBarSessionLegacy(
  workspace: WorkspaceContext,
): Promise<BarSessionDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bar_sessions")
    .select(
      "id, status, opening_note, closing_note, orders_ready_count, closing_orders_pending_count, closing_stock_entries_count, closing_stock_entries_cost, closing_stock_losses_count, closing_stock_losses_qty, closing_low_stock_count, opened_at, closed_at, opened_by, closed_by, profiles!bar_sessions_opened_by_fkey(full_name)",
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("opened_by", workspace.userId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (error || !data) return null;

  return mapSessionDetail(workspace, {
    ...(data as SessionRow),
    closing_summary: null,
    closed_by_profile: null,
  });
}

export async function getOpenBarSessionForEstablishment(
  workspace: WorkspaceContext,
): Promise<BarSessionDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bar_sessions")
    .select(SESSION_SELECT)
    .eq("establishment_id", workspace.establishmentId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (error || !data) {
    if (error?.message?.includes("closing_summary")) {
      const legacy = await supabase
        .from("bar_sessions")
        .select(
          "id, status, opening_note, closing_note, orders_ready_count, closing_orders_pending_count, closing_stock_entries_count, closing_stock_entries_cost, closing_stock_losses_count, closing_stock_losses_qty, closing_low_stock_count, opened_at, closed_at, opened_by, closed_by, profiles!bar_sessions_opened_by_fkey(full_name)",
        )
        .eq("establishment_id", workspace.establishmentId)
        .eq("status", "OPEN")
        .maybeSingle();
      if (legacy.error || !legacy.data) return null;
      return mapSessionDetail(workspace, {
        ...(legacy.data as SessionRow),
        closing_summary: null,
        closed_by_profile: null,
      });
    }
    return null;
  }

  return mapSessionDetail(workspace, data as SessionRow);
}

export async function getBarSessionById(
  workspace: WorkspaceContext,
  sessionId: string,
): Promise<BarSessionDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bar_sessions")
    .select(SESSION_SELECT)
    .eq("establishment_id", workspace.establishmentId)
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return mapSessionDetail(workspace, data as SessionRow);
}

export async function getBarSessionContext(workspace: WorkspaceContext): Promise<{
  ownSession: BarSessionDetail | null;
  openSession: BarSessionDetail | null;
}> {
  try {
    const openSession = await getOpenBarSessionForEstablishment(workspace);
    const ownSession =
      openSession && openSession.isOwnSession ? openSession : null;

    return { ownSession, openSession };
  } catch {
    return { ownSession: null, openSession: null };
  }
}
